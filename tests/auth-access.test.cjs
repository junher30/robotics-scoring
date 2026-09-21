const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function load(file, dependencies){
 const result=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const module={exports:{}};
 vm.runInNewContext(result.outputText,{module,exports:module.exports,require:n=>{if(n in dependencies)return dependencies[n];throw Error('Unexpected dependency '+n)}});
 return module.exports;
}
const profile={id:'476425ff-e684-46ee-ba28-07df532ce9bf',email:'test@example.com',first_name:'',last_name:'',active:true};
function guard(readAccess){return load('lib/auth/authorization.ts',{'server-only':{},'./profile':{readAccess},'next/navigation':{redirect:url=>{throw Error('REDIRECT '+url)}}});}
for(const role of ['SUPER_ADMIN','ADMIN','JUDGE']){
 const area=role==='JUDGE'?'judge':'admin';
 test(role+' enters own area and cannot enter the other area',async()=>{
  const p={...profile,role};const g=guard(async()=>({profile:p}));
  assert.equal(await g.requireAccess(area),p);
  await assert.rejects(g.requireAccess(area==='judge'?'admin':'judge'),{message:`REDIRECT /${area}?aviso=permisos`});
 });
}
for(const reason of ['session','profile','inactive'])test(reason+' denies access',async()=>{
 await assert.rejects(guard(async()=>({profile:null,reason})).requireAccess('admin'),{message:'REDIRECT /login?aviso=acceso'});
});
test('Auth service failure denies access',async()=>{
 await assert.rejects(guard(async()=>{throw Error('offline')}).requireAccess('admin'),{message:'REDIRECT /login?aviso=acceso'});
});
for(const scenario of ['valid','inactive','unknown role','no profile','no user','auth error'])test('Verified profile: '+scenario,async()=>{
 let queryCount=0;
 const record=scenario==='no profile'?null:{...profile,role:scenario==='unknown role'?'OWNER':'JUDGE',active:scenario!=='inactive'};
 const client = {
  auth: { getUser: async () => ({data: {user: scenario === 'no user' ? null : {id: profile.id}}, error: scenario === 'auth error' ? Error('invalid') : null}) },
  from(table) {
   queryCount++;
   assert.equal(table, 'profiles');
   return {select: () => ({eq(key, id) {
    assert.equal(key, 'id'); assert.equal(id, profile.id);
    return {single: async () => ({data: record, error: null})};
   }})};
  }
 };
 const m=load('lib/auth/profile.ts',{'server-only':{},zod:require('zod'),'../supabase/server':{createClient:async()=>client}});
 const result=await m.readAccess();
 assert.equal(Boolean(result.profile),scenario==='valid');
 if(scenario==='no user'||scenario==='auth error')assert.equal(queryCount,0);
});
