import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const db=new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
  CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb,email_confirmed_at timestamptz,invited_at timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO authenticated; GRANT USAGE ON SCHEMA public TO anon;`);
for(const file of ['tests/fixtures/foundation.sql','supabase/migrations/202609160001_profiles_roles.sql','supabase/migrations/202609200002_event_management.sql','supabase/migrations/202609200004_user_management.sql','supabase/migrations/202609200004_user_management.sql']) await db.exec(await fs.readFile(root+file,'utf8'));
const ids=Array.from({length:9},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
for(let i=0;i<5;i++) {
  await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data,email_confirmed_at) VALUES($1,$2,$3,now())',[ids[i],`user${i}@example.test`,{}]);
  await db.query('UPDATE profiles SET role=$1,active=$2 WHERE id=$3',[i===0?'SUPER_ADMIN':i===3?'JUDGE':'ADMIN',i!==4,ids[i]]);
}
async function asUser(id,role='authenticated') {await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE '+role);}
async function reserve(email,role='JUDGE') {return (await db.query('SELECT roboscore_prepare_user_invitation($1,$2,$3,$4,$5) AS id',[email,'Ana','Prueba','',role])).rows[0].id;}
async function version(id) {return (await db.query('SELECT updated_at::text AS version FROM profiles WHERE id=$1',[id])).rows[0].version;}
async function edit(id,role='JUDGE',active=true,v) {return db.query('SELECT roboscore_update_managed_user($1,$2,$3,$4,$5,$6,$7) AS id',[id,v??await version(id),'Ana','Actualizada','123',role,active]);}
let checks=0;const pass=name=>{checks++;console.log('PASS '+name);};
await asUser(ids[1]);
await assert.rejects(reserve('admin@example.test','ADMIN'),{code:'42501'});
await assert.rejects(reserve('super@example.test','SUPER_ADMIN'),{code:'42501'});
await assert.rejects(db.query("UPDATE profiles SET role='SUPER_ADMIN' WHERE id=$1",[ids[1]]),{code:'42501'});
pass('Admin cannot promote, invite admin/superadmin or write profiles directly');
const invitation=await reserve('  JUDGE@example.test ');
await assert.rejects(reserve('judge@example.test'),{code:'P0001'});
await assert.rejects(reserve('user0@example.test'),{code:'23505'});
pass('Normalized email, duplicate account and invitation cooldown');
await asUser(ids[2]);
await assert.rejects(reserve('judge@example.test'),{code:'42501'});
pass('Another administrator cannot take over a pending invitation');
await db.exec('RESET ROLE');
// Auth inserts the user before sendInvite updates invited_at. Match that sequence.
await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[ids[5],'judge@example.test',{roboscore_invitation_id:invitation,role:'SUPER_ADMIN',active:false}]);
let judge=(await db.query('SELECT * FROM profiles WHERE id=$1',[ids[5]])).rows[0];
assert.equal(judge.role,'JUDGE');assert.equal(judge.active,true);assert.equal(judge.managed_by,ids[1]);assert.equal(judge.first_name,'Ana');
pass('Auth trigger uses authorized reservation; ignores metadata role and active');
await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[ids[6],'impostor@example.test',{roboscore_invitation_id:invitation,role:'SUPER_ADMIN',active:true}]);
let impostor=(await db.query('SELECT * FROM profiles WHERE id=$1',[ids[6]])).rows[0];
assert.equal(impostor.role,'JUDGE');assert.equal(impostor.active,false);assert.equal(impostor.managed_by,null);
pass('Wrong email or reused invitation cannot grant privileges');
await asUser(ids[1]);
assert.deepEqual((await db.query('SELECT id FROM profiles ORDER BY id')).rows.map(r=>r.id),[ids[1],ids[5]]);
await asUser(ids[2]);
assert.equal((await db.query('SELECT id FROM profiles WHERE id=$1',[ids[5]])).rows.length,0);
await assert.rejects(edit(ids[5],'JUDGE',true,judge.updated_at),{code:'42501'});
pass('Managers can read/edit only their own judges');
await asUser(ids[1]);
const stale=await version(ids[5]);
await edit(ids[5],'JUDGE',false,stale);
await assert.rejects(edit(ids[5],'JUDGE',true,stale),{code:'40001'});
await edit(ids[5]);
pass('Deactivate/reactivate preserves data and stale updates are rejected');
await asUser(ids[0]);
await assert.rejects(edit(ids[0],'ADMIN',false),{code:'42501'});
await assert.rejects(edit(ids[5],'SUPER_ADMIN',true),{code:'42501'});
await edit(ids[5],'ADMIN');
await asUser(ids[1]);
assert.equal((await db.query('SELECT id FROM profiles WHERE id=$1',[ids[5]])).rows.length,0);
await assert.rejects(edit(ids[5],'JUDGE',true,new Date().toISOString()),{code:'42501'});
pass('Superadmin protected; only superadmin can promote; old manager loses access');
await asUser(ids[0]);
const invitationAdmin=await reserve('newadmin@example.test','ADMIN');
await db.exec('RESET ROLE');
await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[ids[7],'newadmin@example.test',{roboscore_invitation_id:invitationAdmin}]);
assert.equal((await db.query('SELECT role FROM profiles WHERE id=$1',[ids[7]])).rows[0].role,'ADMIN');
pass('Superadmin invitation creates an administrator atomically');
for(const i of [3,4]) {
  await asUser(ids[i]);
  await assert.rejects(reserve(`blocked${i}@example.test`),{code:'42501'});
  await assert.rejects(edit(ids[5],'JUDGE',false,new Date().toISOString()),{code:'42501'});
}
await asUser('','anon');
await assert.rejects(reserve('anon@example.test'),{code:'42501'});
await assert.rejects(db.query('SELECT * FROM profiles'),{code:'42501'});
pass('Judge, inactive administrator and visitor cannot manage accounts');
await asUser(ids[2]);
const withdrawn=await reserve('withdrawn@example.test');
await db.exec('RESET ROLE');await db.query('UPDATE profiles SET active=false WHERE id=$1',[ids[2]]);
await assert.rejects(db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[ids[8],'withdrawn@example.test',{roboscore_invitation_id:withdrawn}]),{code:'42501'});
pass('Deactivation before Auth creation invalidates pending authorization');
await db.query("UPDATE roboscore_private.user_invitations SET last_attempt_at=now()-interval '2 minutes' WHERE id=$1",[invitationAdmin]);
await asUser(ids[0]);assert.equal(await reserve('newadmin@example.test','ADMIN'),invitationAdmin);
await db.exec('RESET ROLE');await db.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1',[ids[7]]);
await db.query("UPDATE roboscore_private.user_invitations SET last_attempt_at=now()-interval '2 minutes' WHERE id=$1",[invitationAdmin]);
await asUser(ids[0]);await assert.rejects(reserve('newadmin@example.test','ADMIN'),{code:'23505'});
pass('Pending invitation can retry; confirmed account cannot be reinvited');
await assert.rejects(db.query('SELECT * FROM roboscore_private.user_invitations'),{code:'42501'});
await assert.rejects(db.query('DELETE FROM profiles'),{code:'42501'});
pass('Invitation data private and permanent profile deletion denied');
await db.exec('RESET ROLE');
const verification=(await db.query(await fs.readFile(root+'supabase/verify-phase-11.sql','utf8'))).rows;
assert.equal(verification.length,8);assert(verification.every(row=>row.passed));
pass('Migration repeatable and eight deployment checks pass');
await db.close();console.log(`${checks} PostgreSQL checks passed. No Supabase connection or email sent.`);
