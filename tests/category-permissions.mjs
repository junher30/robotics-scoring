import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const db = new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
  CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO authenticated; GRANT USAGE ON SCHEMA public TO anon;`);
for (const file of ['tests/fixtures/foundation.sql', 'supabase/migrations/202609160001_profiles_roles.sql', 'supabase/migrations/202609200002_event_management.sql']) {
  await db.exec(await fs.readFile(root + file, 'utf8'));
}
const migration = await fs.readFile(root + 'supabase/migrations/202609200003_category_management.sql', 'utf8');
await db.exec(migration);
await db.exec(migration);
const users = Array.from({ length: 5 }, (_, i) => `00000000-0000-4000-8000-00000000000${i + 1}`);
for (let i = 0; i < users.length; i++) {
  await db.query('INSERT INTO auth.users VALUES($1,$2,$3)', [users[i], `fixture${i}@example.test`, {}]);
  await db.query('UPDATE profiles SET role=$1,active=$2 WHERE id=$3', [i === 0 ? 'SUPER_ADMIN' : i === 3 ? 'JUDGE' : 'ADMIN', i !== 4, users[i]]);
}
async function asUser(id, role = 'authenticated') {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('SET ROLE ' + role);
}
let checks = 0;
const pass = label => { checks++; console.log('PASS ' + label); };
const eventIds = [];
for (let i = 1; i <= 2; i++) {
  await asUser(users[i]);
  eventIds.push((await db.query("INSERT INTO events(name,slug,start_date,end_date,created_by) VALUES('Evento',$1,now(),now()+interval '1 day',$2) RETURNING id", ['evento-' + i, users[i]])).rows[0].id);
}
async function create(eventId, name) {
  return (await db.query('INSERT INTO event_categories(event_id,name) VALUES($1,$2) RETURNING id', [eventId, name])).rows[0].id;
}
await asUser(users[1]);
const categoryA = await create(eventIds[0], 'Mini Sumo');
await asUser(users[2]);
const categoryB = await create(eventIds[1], 'Mini Sumo');
pass('Same category name allowed in different events');
await asUser(users[1]);
assert.equal((await db.query('SELECT id FROM event_categories')).rows.length, 1);
assert.equal((await db.query('SELECT id FROM event_categories WHERE id=$1', [categoryB])).rows.length, 0);
pass('Administrator sees only own event categories');
await assert.rejects(create(eventIds[1], 'Foreign'), { code: '42501' });
assert.equal((await db.query("UPDATE event_categories SET name='Foreign' WHERE id=$1 RETURNING id", [categoryB])).rows.length, 0);
pass('Foreign insertion and update denied');
await assert.rejects(create(eventIds[0], ' mini sumo '), { code: '23505' });
pass('Names unique after trimming and case folding');
const second = await create(eventIds[0], 'Innovación');
await assert.rejects(db.query("UPDATE event_categories SET name='MINI SUMO' WHERE id=$1", [second]), { code: '23505' });
pass('Rename cannot duplicate an existing name');
await assert.rejects(db.query('UPDATE event_categories SET event_id=$1 WHERE id=$2', [eventIds[1], categoryA]), { code: '42501' });
await assert.rejects(db.query('UPDATE event_categories SET id=gen_random_uuid() WHERE id=$1', [categoryA]), { code: '42501' });
await assert.rejects(db.query('UPDATE event_categories SET updated_at=now() WHERE id=$1', [categoryA]), { code: '42501' });
pass('Cannot change parent, identity or timestamp');
await assert.rejects(db.query('DELETE FROM event_categories WHERE id=$1', [categoryA]), { code: '42501' });
pass('Permanent deletion denied');
await assert.rejects(db.query('UPDATE event_categories SET max_teams=0 WHERE id=$1', [categoryA]), { code: '23514' });
await assert.rejects(db.query('UPDATE event_categories SET sort_order=-1 WHERE id=$1', [categoryA]), { code: '23514' });
pass('Database enforces positive capacity and nonnegative order');
const before = (await db.query('SELECT updated_at::text AS version FROM event_categories WHERE id=$1', [categoryA])).rows[0].version;
await db.query("UPDATE event_categories SET status='CLOSED',sort_order=10 WHERE id=$1", [categoryA]);
assert.equal((await db.query("UPDATE event_categories SET name='Stale' WHERE id=$1 AND updated_at=$2 RETURNING id", [categoryA, before])).rows.length, 0);
pass('Stale edit cannot overwrite a newer version');
assert.equal((await db.query('SELECT status FROM event_categories WHERE id=$1', [categoryA])).rows[0].status, 'CLOSED');
await db.query("UPDATE event_categories SET status='ACTIVE' WHERE id=$1", [categoryA]);
const sorted = (await db.query('SELECT id FROM event_categories ORDER BY sort_order,name,id')).rows;
assert.equal(sorted[0].id, second); assert.equal(sorted[1].id, categoryA);
pass('Close/reopen preserves category and order is respected');
for (const index of [3, 4]) {
  await asUser(users[index]);
  assert.equal((await db.query('SELECT id FROM event_categories')).rows.length, 0);
  await assert.rejects(create(eventIds[0], 'Denied'), { code: '42501' });
  assert.equal((await db.query("UPDATE event_categories SET name='Denied' RETURNING id")).rows.length, 0);
  pass('Judge or inactive administrator cannot read/write: ' + index);
}
await asUser('', 'anon');
await assert.rejects(db.query('SELECT * FROM event_categories'), { code: '42501' });
pass('Anonymous read denied');
await asUser(users[0]);
assert.equal((await db.query('SELECT id FROM event_categories')).rows.length, 3);
assert.equal((await db.query("UPDATE event_categories SET description='Updated by superadmin' WHERE id=$1 RETURNING id", [categoryB])).rows.length, 1);
await create(eventIds[1], 'Superadmin category');
pass('Superadmin can read/create/edit across events');
await db.exec('RESET ROLE');
await db.query('UPDATE profiles SET active=false WHERE id=$1', [users[1]]);
await asUser(users[1]);
assert.equal((await db.query('SELECT id FROM event_categories')).rows.length, 0);
await assert.rejects(create(eventIds[0], 'Disabled'), { code: '42501' });
pass('Deactivation removes access immediately');
await db.exec('RESET ROLE');
const result = await db.query(await fs.readFile(root + 'supabase/verify-phase-10.sql', 'utf8'));
assert.equal(result.rows.length, 8);
assert(result.rows.every(row => row.passed));
pass('Eight verification checks pass; migration is repeatable');
await db.close();
console.log(`${checks} PostgreSQL checks passed. No Supabase connection used.`);
