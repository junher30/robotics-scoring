const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'..','lib/users/password.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:mod,exports:mod.exports,require});
const {passwordErrorMessage}=mod.exports;
test('Each Supabase failure gets its own explanation',()=>{
 assert.match(passwordErrorMessage({code:'weak_password',reasons:['pwned']}),/filtraciones/);
 assert.match(passwordErrorMessage({code:'weak_password',reasons:['characters']}),/mayúsculas/);
 assert.match(passwordErrorMessage({name:'AuthWeakPasswordError',reasons:['length']}),/requisitos/);
 assert.match(passwordErrorMessage({code:'same_password'}),/diferente/);
 assert.match(passwordErrorMessage({code:'reauthentication_needed'}),/confirmar/);
 assert.match(passwordErrorMessage({name:'AuthSessionMissingError',status:400}),/venció/);
 assert.match(passwordErrorMessage({status:401}),/venció/);
 assert.match(passwordErrorMessage({status:429}),/demasiados/i);
});
test('Unknown errors fall back to a safe generic message without leaking details',()=>{const message=passwordErrorMessage({code:'unexpected_failure',status:500});assert.match(message,/nueva invitación/);assert.ok(!message.includes('unexpected_failure'))});
