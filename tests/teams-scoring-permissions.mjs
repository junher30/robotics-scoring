import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);const db=new PGlite();
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
GRANT USAGE ON SCHEMA public,auth TO authenticated;GRANT USAGE ON SCHEMA public TO anon;`);
for(const file of ['tests/fixtures/foundation.sql','supabase/migrations/202609160001_profiles_roles.sql','supabase/migrations/202609200002_event_management.sql','supabase/migrations/202609200003_category_management.sql','supabase/migrations/202609210001_teams_scoring.sql','supabase/migrations/202609210001_teams_scoring.sql'])await db.exec(await fs.readFile(new URL(file,root),'utf8'));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
for(let i=1;i<=5;i++){await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[id(i),`person${i}@example.test`,{}]);await db.query('UPDATE profiles SET role=$1,active=$2 WHERE id=$3',[i===1?'SUPER_ADMIN':i===4?'JUDGE':'ADMIN',i!==5,id(i)]);}
async function asUser(n,role='authenticated'){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);await db.exec('SET ROLE '+role);}
await db.query("INSERT INTO events(id,name,slug,start_date,end_date,created_by,status,max_teams) VALUES($1,'Evento A','evento-a',now(),now()+interval '1 day',$2,'ACTIVE',3),($3,'Evento B','evento-b',now(),now()+interval '1 day',$4,'ACTIVE',null)",[id(10),id(2),id(11),id(3)]);
await db.query("INSERT INTO event_categories(id,event_id,name,status,max_teams) VALUES($1,$2,'Categoría A','ACTIVE',2),($3,$2,'Categoría B','ACTIVE',null),($4,$5,'Categoría ajena','ACTIVE',null)",[id(20),id(10),id(21),id(22),id(11)]);
async function team(n=30,category=20,event=10,version=null,name='Equipo '+n,active=true){return db.query('SELECT roboscore_save_team($1,$2,$3,$4,$5,$6,$7,$8) AS id',[id(event),id(n),version,id(category),name,'Institución de prueba','Robot',active]);}
async function config(category=20,rule='EXCEL_2026',count=4,event=10){return db.query('SELECT roboscore_configure_scoring($1,$2,$3,$4)',[id(event),id(category),rule,count]);}
async function board(category=20,event=10){return (await db.query('SELECT roboscore_scoring_board($1,$2) AS board',[id(event),id(category)])).rows[0].board;}
async function version(table,n){return (await db.query(`SELECT updated_at::text AS v FROM ${table} WHERE id=$1`,[n])).rows[0].v;}
async function save(teamId,challenge,attempt,seconds,version=null,notes='',event=10,completed=true){return db.query('SELECT roboscore_save_score($1,$2,$3,$4,$5,$6,$7,$8) AS id',[id(event),id(teamId),challenge,version,attempt,seconds,completed,notes]);}
let checks=0;const pass=label=>{checks++;console.log('PASS '+label);};
await asUser(2);await team();await team();assert.equal((await db.query('SELECT id FROM teams')).rows.length,1);pass('Creation retries do not duplicate teams');
await assert.rejects(team(31,20,10,null,' equipo 30 '),{code:'23505'});await assert.rejects(team(31,22),{code:'22023'});pass('Duplicate names and categories from other events rejected');
await team(31);await assert.rejects(team(32),{code:'22023'});await team(32,21);await assert.rejects(team(33,21),{code:'22023'});pass('Category and event capacities enforced');
const oldTeamVersion=await version('teams',id(30));await team(30,20,10,oldTeamVersion,'Equipo actualizado');await assert.rejects(team(30,20,10,oldTeamVersion,'Overwrite'),{code:'40001'});pass('Stale team edit cannot overwrite');
await config();let b=await board();assert.equal(b.challenges.length,4);assert.equal(b.teams[0].total,null);assert.equal(b.teams[0].position,null);pass('Four challenges configured; missing scores are not zero');
const challenge=b.challenges[0].id;
await assert.rejects(save(30,challenge,1,'1.0001'),{code:'22023'});await assert.rejects(save(30,challenge,-1,5),{code:'22023'});await assert.rejects(save(30,challenge,1,-5),{code:'22023'});pass('Invalid attempt, negative time and excess precision rejected');
await save(30,challenge,1,'5.250');b=await board();assert.equal(Number(b.teams[0].total),164.75);assert.equal(b.teams[0].scored_count,1);assert.equal(b.has_scores,true);pass('Points use exact Excel base less seconds');
await assert.rejects(config(20,'LEGACY_C'),{code:'22023'});await assert.rejects(team(30,21,10,await version('teams',id(30))),{code:'22023'});pass('Rule and category cannot change after scoring');
await save(31,challenge,1,'5.250');b=await board();assert.deepEqual(b.teams.map(t=>t.position),[1,1]);pass('Equal totals share rank');
await assert.rejects(save(30,challenge,2,10),{code:'40001'});let score=(await db.query('SELECT id,updated_at::text AS v FROM team_scores WHERE team_id=$1',[id(30)])).rows[0];
await assert.rejects(save(30,challenge,2,10,score.v),{code:'22023'});await save(30,challenge,2,10,score.v,'Corrección del cronómetro');await assert.rejects(save(30,challenge,2,9,score.v,'Otra corrección'),{code:'40001'});
const revisions=(await db.query('SELECT old_data,new_data FROM score_revisions WHERE score_id=$1 ORDER BY id',[score.id])).rows;assert.equal(revisions.length,2);assert.equal(Number(revisions[1].old_data.points),164.75);assert.equal(Number(revisions[1].new_data.points),140);pass('Corrections require reason, preserve history and reject stale scores');
await team(30,20,10,await version('teams',id(30)),'Equipo retirado',false);b=await board();assert.equal(b.teams.length,1);assert.equal((await db.query('SELECT id FROM team_scores WHERE team_id=$1',[id(30)])).rows.length,1);await assert.rejects(save(30,b.challenges[1].id,1,10),{code:'22023'});pass('Withdrawal excludes ranking but preserves scores');
await team(30,20,10,await version('teams',id(30)),'Equipo retirado',true);
await config(21,'LEGACY_C',3);const otherChallenge=(await board(21)).challenges[0].id;await assert.rejects(save(30,otherChallenge,1,10),{code:'22023'});pass('Cannot score a challenge from another category');
for(const [rule,attempt,seconds,completed,expected] of [['EXCEL_2026',0,0,true,0],['EXCEL_2026',1,5.25,true,164.75],['EXCEL_2026',2,40,true,110],['EXCEL_2026',4,135,true,-5],['LEGACY_C',2,30,true,60],['LEGACY_C',0,30,true,100],['LEGACY_D',2,30,true,120],['LEGACY_D',1,10,false,0]]){const value=(await db.query('SELECT roboscore_score_points($1,$2,$3,$4) AS p',[rule,attempt,seconds,completed])).rows[0].p;assert.equal(Number(value),expected);}
pass('Modern and both legacy formulas match zero, negative and later-attempt cases');
await asUser(3);assert.equal((await db.query('SELECT id FROM teams')).rows.length,0);await assert.rejects(team(34),{code:'42501'});await assert.rejects(save(30,challenge,1,0),{code:'42501'});await assert.rejects(board(),{code:'42501'});pass('Foreign administrator cannot read, write or rank event');
for(const n of [4,5]){await asUser(n);await assert.rejects(team(34),{code:'42501'});await assert.rejects(config(),{code:'42501'});await assert.rejects(save(30,challenge,1,0),{code:'42501'});assert.equal((await db.query('SELECT id FROM team_scores')).rows.length,0);}pass('Unassigned judges and inactive users denied');
await asUser(0,'anon');await assert.rejects(board(),{code:'42501'});await assert.rejects(db.query('SELECT * FROM team_scores'),{code:'42501'});pass('Anonymous access denied');
await asUser(1);assert.equal((await board()).teams.length,2);await assert.rejects(db.query('UPDATE team_scores SET attempt=0'),{code:'42501'});await assert.rejects(db.query('DELETE FROM teams'),{code:'42501'});await assert.rejects(db.query('DELETE FROM score_revisions'),{code:'42501'});pass('Superadmin authorized through RPC; direct writes and deletion denied');
await db.query("UPDATE events SET status='FINISHED' WHERE id=$1",[id(10)]);await assert.rejects(save(30,b.challenges[1].id,1,10),{code:'22023'});await assert.rejects(team(34),{code:'22023'});pass('Finished event prevents score and team edits');
await db.exec('RESET ROLE');
const verification=await db.query(await fs.readFile(new URL('supabase/verify-teams-scoring.sql',root),'utf8'));
assert.equal(verification.rows.length,8);for(const check of verification.rows)assert.equal(check.passed,true,check.check_name);pass('Deployment verification reports eight passing checks');
await db.close();console.log(`${checks} PostgreSQL checks passed; no remote data changed.`);
