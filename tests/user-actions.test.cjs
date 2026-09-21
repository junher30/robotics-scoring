const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function load(file,dependencies={}){
  const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,require:n=>n in dependencies?dependencies[n]:require(n),Date});
  return module.exports;
}
const profileId='00000000-0000-4000-8000-000000000001';

// ---------- app/auth/invitacion/actions.ts ----------
function acceptFixture(){
  const state={verify:{data:{user:{id:profileId}},error:null},profileRow:{data:{active:true},error:null},signedOut:0};
  const client={
    auth:{
      verifyOtp:async()=>state.verify,
      signOut:async arg=>{assert.equal(arg.scope,'local');state.signedOut++;},
    },
    from(table){assert.equal(table,'profiles');return {select:col=>{assert.equal(col,'active');return {eq:(key,id)=>{assert.equal(key,'id');assert.equal(id,profileId);return {single:async()=>state.profileRow};}};}};},
  };
  const action=load('app/auth/invitacion/actions.ts',{
    'next/navigation':{redirect:url=>{throw Error('REDIRECT '+url);}},
    '../../../lib/supabase/server':{createClient:async remember=>{assert.equal(remember,false);if(state.throwOnClient)throw Error('offline');return client;}},
  });
  return {state,accept:token=>action.acceptInvitation(token,{})};
}
const validToken='a'.repeat(40);
test('Invitation link with an invalid shape is rejected before touching Supabase',async()=>{
  const f=acceptFixture();
  const result=await f.accept('not-a-token');
  assert.match(result.message,/enlace no es válido/);
});
test('Expired or already-used invitation link shows a recoverable message',async()=>{
  const f=acceptFixture();f.state.verify={data:{user:null},error:{message:'expired'}};
  const result=await f.accept(validToken);
  assert.match(result.message,/venció o ya fue utilizado/);
});
test('Verified but inactive/missing profile signs the session out locally',async()=>{
  const f=acceptFixture();f.state.profileRow={data:{active:false},error:null};
  const result=await f.accept(validToken);
  assert.match(result.message,/no está habilitada/);assert.equal(f.state.signedOut,1);
});
test('Profile lookup failure also denies and signs out',async()=>{
  const f=acceptFixture();f.state.profileRow={data:null,error:{message:'db'}};
  const result=await f.accept(validToken);
  assert.match(result.message,/no está habilitada/);assert.equal(f.state.signedOut,1);
});
test('Valid invitation redirects to create a password',async()=>{
  const f=acceptFixture();
  await assert.rejects(f.accept(validToken),{message:'REDIRECT /cuenta/crear-clave'});
  assert.equal(f.state.signedOut,0);
});
test('Connection failure during verification is reported without leaking detail',async()=>{
  const f=acceptFixture();f.state.throwOnClient=true;
  const result=await f.accept(validToken);
  assert.match(result.message,/No pudimos confirmar el acceso/);
});

// ---------- app/cuenta/crear-clave/actions.ts ----------
function passwordFixture(role='JUDGE'){
  const state={updateError:null,revalidated:0,denied:false};
  const action=load('app/cuenta/crear-clave/actions.ts',{
    '../../../lib/auth/authorization':{requireAccess:async()=>{if(state.denied)throw Error('DENIED');return {id:profileId,role};},homeForRole:r=>r==='JUDGE'?'/judge':'/admin'},
    '../../../lib/supabase/server':{createClient:async()=>({auth:{updateUser:async arg=>{state.password=arg.password;return {error:state.updateError};}}})},
    '../../../lib/users/password':load('lib/users/password.ts'),
    'next/navigation':{redirect:url=>{throw Error('REDIRECT '+url);}},
    'next/cache':{revalidatePath:()=>{state.revalidated++;}},
  });
  return {state,save:form=>action.savePassword({},form)};
}
function passwordForm(password,confirmation=password){const f=new FormData();f.set('password',password);f.set('confirmation',confirmation);return f;}
test('Short password is rejected before calling Supabase',async()=>{
  const f=passwordFixture();
  const result=await f.save(passwordForm('short'));
  assert(result.errors.password);
});
test('Mismatched confirmation is rejected',async()=>{
  const f=passwordFixture();
  const result=await f.save(passwordForm('una-frase-larga-1','otra-frase-larga-1'));
  assert(result.errors.confirmation);
});
test('Supabase rejecting the new password surfaces a guidance message',async()=>{
  const f=passwordFixture();f.state.updateError={message:'weak'};
  const result=await f.save(passwordForm('una-frase-bien-larga'));
  assert.match(result.message,/No se pudo guardar/);
});
test('Saved password redirects a judge to /judge and an admin to /admin',async()=>{
  const judge=passwordFixture('JUDGE');
  await assert.rejects(judge.save(passwordForm('una-frase-bien-larga')),{message:'REDIRECT /judge'});
  assert.equal(judge.state.revalidated,1);assert.equal(judge.state.password,'una-frase-bien-larga');
  const admin=passwordFixture('ADMIN');
  await assert.rejects(admin.save(passwordForm('una-frase-bien-larga')),{message:'REDIRECT /admin'});
});
test('Session no longer valid when saving denies access',async()=>{
  const f=passwordFixture();f.state.denied=true;
  await assert.rejects(f.save(passwordForm('una-frase-bien-larga')),{message:'DENIED'});
});

// ---------- app/admin/usuarios/actions.ts ----------
const schema=load('lib/users/schema.ts');
function userFixture({actorRole='SUPER_ADMIN',ready=true}={}){
  const state={rpc:{data:'00000000-0000-4000-8000-0000000000aa',error:null},invite:{error:null},update:{data:null,error:null},refreshed:0,inviteCalls:0};
  const action=load('app/admin/usuarios/actions.ts',{
    zod:require('zod'),
    'next/navigation':{redirect:url=>{throw Error('REDIRECT '+url);}},
    'next/cache':{revalidatePath:()=>{state.refreshed++;}},
    '../../../lib/users/access':{requireUserManager:async()=>({id:'00000000-0000-4000-8000-000000000009',role:actorRole})},
    '../../../lib/users/schema':schema,
    '../../../lib/supabase/server':{createClient:async()=>({rpc:async(name,args)=>{assert.equal(name,'roboscore_prepare_user_invitation');state.rpcArgs=args;return state.rpc;}})},
    '../../../lib/supabase/admin':{
      invitationConfig:()=>{if(!ready)throw Error('not configured');return {redirectTo:'https://roboscore.test/auth/invitacion'};},
      createAdminClient:()=>({auth:{admin:{inviteUserByEmail:async(email,opts)=>{state.inviteCalls++;state.inviteArgs={email,opts};return state.invite;}}}}),
    },
  });
  return {state,invite:form=>action.inviteUser({},form)};
}
function inviteForm(overrides={}){const values={first_name:'Ana',last_name:'Prueba',email:'ana@example.test',phone:'',role:'JUDGE',active:'true',...overrides};const f=new FormData();Object.entries(values).forEach(([k,v])=>f.set(k,v));return f;}
test('Administrator cannot invite another administrator',async()=>{
  const f=userFixture({actorRole:'ADMIN'});
  const result=await f.invite(inviteForm({role:'ADMIN'}));
  assert.match(result.message,/Solo el superadministrador/);assert.equal(f.state.inviteCalls,0);
});
test('Missing server configuration is reported before touching the database',async()=>{
  const f=userFixture({ready:false});
  const result=await f.invite(inviteForm());
  assert.match(result.message,/fase 11/);assert.equal(f.state.inviteCalls,0);
});
test('Invalid fields never reach Supabase',async()=>{
  const f=userFixture();
  const result=await f.invite(inviteForm({email:'not-an-email'}));
  assert(result.errors.email);assert.equal(f.state.inviteCalls,0);
});
test('Database rejection is translated into a message',async()=>{
  const f=userFixture();f.state.rpc={data:null,error:{code:'23505',message:'El correo ya está en uso.'}};
  const result=await f.invite(inviteForm());
  assert.equal(result.message,'El correo ya está en uso.');assert.equal(f.state.inviteCalls,0);
});
test('Supabase rate limiting the invite email is reported distinctly',async()=>{
  const f=userFixture();f.state.invite={error:{status:429}};
  const result=await f.invite(inviteForm());
  assert.match(result.message,/limitó los envíos/);
});
test('Successful invitation reaches Auth with the reservation id and refreshes listings',async()=>{
  const f=userFixture();
  const result=await f.invite(inviteForm());
  assert.equal(result.success,true);
  assert.equal(f.state.inviteArgs.email,'ana@example.test');
  assert.equal(f.state.inviteArgs.opts.redirectTo,'https://roboscore.test/auth/invitacion');
  assert.equal(f.state.inviteArgs.opts.data.roboscore_invitation_id,f.state.rpc.data);
  assert(f.state.refreshed>0);
});
test('An account cannot edit itself',async()=>{
  const actorId='00000000-0000-4000-8000-000000000009';
  const action=load('app/admin/usuarios/actions.ts',{
    zod:require('zod'),
    'next/navigation':{redirect:url=>{throw Error('REDIRECT '+url);}},
    'next/cache':{revalidatePath:()=>{}},
    '../../../lib/users/access':{requireUserManager:async()=>({id:actorId,role:'SUPER_ADMIN'})},
    '../../../lib/users/schema':schema,
    '../../../lib/supabase/server':{createClient:async()=>({rpc:async()=>({data:actorId,error:null})})},
    '../../../lib/supabase/admin':{invitationConfig:()=>({redirectTo:'https://roboscore.test/auth/invitacion'}),createAdminClient:()=>({})},
  });
  const form=inviteForm({active:'true'});
  const result=await action.updateUser(actorId,'2026-09-20T12:00:00.000Z',{},form);
  assert.match(result.message,/No puedes modificar esta cuenta/);
});
