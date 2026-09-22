import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const db=new PGlite();const root=fileURLToPath(new URL('../',import.meta.url));
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA public,auth TO authenticated; GRANT USAGE ON SCHEMA public TO anon;`);
await db.exec(await fs.readFile(root+'tests/fixtures/foundation.sql','utf8'));
await db.exec(await fs.readFile(root+'supabase/migrations/202609160001_profiles_roles.sql','utf8'));
const migration=await fs.readFile(root+'supabase/migrations/202609200002_event_management.sql','utf8');await db.exec(migration);await db.exec(migration);
await db.exec(await fs.readFile(root+'supabase/migrations/202609220004_share_events_with_admins.sql','utf8'));
const ids=Array.from({length:5},(_,i)=>`00000000-0000-4000-8000-00000000000${i+1}`);
for(let i=0;i<5;i++){await db.query('INSERT INTO auth.users VALUES ($1,$2,$3)',[ids[i],'user'+i+'@example.test',{}]);await db.query('UPDATE profiles SET role=$1,active=$2 WHERE id=$3',[i===0?'SUPER_ADMIN':i===3?'JUDGE':'ADMIN',i!==4,ids[i]]);}
async function as(id,role='authenticated'){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE '+role);}
async function insert(owner,slug){return (await db.query(`INSERT INTO events(name,slug,start_date,end_date,created_by) VALUES ('Competencia',$1,'2026-10-01T10:00:00-05','2026-10-02T10:00:00-05',$2) RETURNING id,updated_at`,[slug,owner])).rows[0];}
let checks=0;const pass=s=>{checks++;console.log('PASS '+s)};
await as(ids[1]);const a=await insert(ids[1],'evento-a');await as(ids[2]);const b=await insert(ids[2],'evento-b');pass('Admins can create own events');
await as(ids[1]);await db.query('UPDATE events SET public=true WHERE id=$1',[a.id]);assert.equal((await db.query('SELECT id FROM events')).rows.length,1);assert.equal((await db.query('SELECT id FROM events WHERE id=$1',[b.id])).rows.length,0);pass('Foreign events are invisible');
assert.equal((await db.query("UPDATE events SET name='Intrusión' WHERE id=$1 RETURNING id",[b.id])).rows.length,0);pass('Foreign updates blocked');
await assert.rejects(insert(ids[2],'spoofed-owner'),{code:'42501'});pass('Cannot spoof event owner');
await assert.rejects(db.query('UPDATE events SET created_by=$1 WHERE id=$2',[ids[2],a.id]),{code:'42501'});pass('Cannot transfer ownership');
await assert.rejects(db.query('UPDATE events SET slug=$1 WHERE id=$2',['new-slug',a.id]),{code:'42501'});pass('Slug immutable');
await assert.rejects(db.query('DELETE FROM events WHERE id=$1',[a.id]),{code:'42501'});pass('Permanent deletion blocked');
await assert.rejects(db.query("UPDATE events SET end_date='2026-01-01' WHERE id=$1",[a.id]),{code:'23514'});pass('DB rejects inverted dates');
const before=(await db.query('SELECT updated_at::text AS version FROM events WHERE id=$1',[a.id])).rows[0].version;
await db.query("UPDATE events SET name='Cambio' WHERE id=$1",[a.id]);assert.equal((await db.query("UPDATE events SET name='Stale' WHERE id=$1 AND updated_at=$2 RETURNING id",[a.id,before])).rows.length,0);pass('Stale version does not overwrite changes');
await db.query("UPDATE events SET status='CANCELLED' WHERE id=$1",[a.id]);assert.equal((await db.query('SELECT status FROM events WHERE id=$1',[a.id])).rows[0].status,'CANCELLED');await db.query("UPDATE events SET status='DRAFT' WHERE id=$1",[a.id]);pass('Cancellation preserves record and is reversible');
for(const i of [3,4]){await as(ids[i]);assert.equal((await db.query('SELECT id FROM events')).rows.length,0);await assert.rejects(insert(ids[i],'denied-'+i),{code:'42501'});assert.equal((await db.query("UPDATE events SET name='Denied' RETURNING id")).rows.length,0);pass('Judge/inactive cannot read or write '+i);}
await as('', 'anon');await assert.rejects(db.query('SELECT * FROM events'),{code:'42501'});pass('Anonymous cannot read even public events');
await as(ids[2]);await db.query('UPDATE events SET shared_with_admins=true WHERE id=$1',[b.id]);pass('Owner shares an event with other admins');
await as(ids[1]);assert.equal((await db.query('SELECT id FROM events')).rows.length,2);assert.equal((await db.query("UPDATE events SET city='Compartida' WHERE id=$1 RETURNING id",[b.id])).rows.length,1);pass('Shared event is visible and editable by a foreign admin');
await assert.rejects(db.query('UPDATE events SET shared_with_admins=false WHERE id=$1',[b.id]),{code:'42501'});pass('A foreign admin cannot revoke sharing themselves');
await as(ids[2]);await db.query('UPDATE events SET shared_with_admins=false WHERE id=$1',[b.id]);await as(ids[1]);assert.equal((await db.query('SELECT id FROM events WHERE id=$1',[b.id])).rows.length,0);pass('Owner can revoke sharing again');
await as(ids[0]);assert.equal((await db.query('SELECT id FROM events')).rows.length,2);assert.equal((await db.query("UPDATE events SET city='Medellín' WHERE id=$1 RETURNING id",[a.id])).rows.length,1);pass('Superadmin sees and edits all');
await db.exec('RESET ROLE');await db.query('UPDATE profiles SET active=false WHERE id=$1',[ids[1]]);await as(ids[1]);assert.equal((await db.query('SELECT id FROM events')).rows.length,0);pass('Deactivation immediately removes access');
await db.exec('RESET ROLE');await db.exec(await fs.readFile(root+'supabase/migrations/202609220005_delete_events.sql','utf8'));
const empty=await insert(ids[2],'evento-vacio');
await as(ids[2]);await assert.rejects(db.query('SELECT roboscore_delete_event($1)',[empty.id]),{code:'42501'});pass('Only SUPER_ADMIN may delete events, even the event owner cannot');
await db.exec('RESET ROLE');await db.query("INSERT INTO event_categories(event_id,name) VALUES($1,'Categoría')",[a.id]);
await as(ids[0]);await assert.rejects(db.query('SELECT roboscore_delete_event($1)',[a.id]),{code:'22023'});pass('Superadmin cannot delete an event that already has categories');
assert.equal((await db.query('SELECT roboscore_delete_event($1) AS id',[empty.id])).rows[0].id,empty.id);assert.equal((await db.query('SELECT id FROM events WHERE id=$1',[empty.id])).rows.length,0);pass('Superadmin can permanently delete an event with no categories yet');
await db.exec('RESET ROLE');
const verification=await db.query(await fs.readFile(root+'supabase/verify-phase-9.sql','utf8'));assert(verification.rows.every(r=>r.passed));pass('All verification checks true');
console.log(checks+' PostgreSQL checks passed; migration repeatable');await db.close();
