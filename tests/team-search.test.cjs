const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');
const file=path.join(__dirname,'..','lib/scoring/search.ts');
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:mod,exports:mod.exports,RegExp});
const {matchesTeamQuery,byTeamNumber}=mod.exports;
const team=(name,team_number,institution='Colegio',robot_name=null)=>({name,institution,robot_name,team_number});
test('A number finds the team with that number, with or without #',()=>{assert.ok(matchesTeamQuery(team('Alfa',7),'7'));assert.ok(matchesTeamQuery(team('Alfa',7),'#7'));assert.ok(!matchesTeamQuery(team('Alfa',17),'7'));assert.ok(!matchesTeamQuery(team('Alfa',null),'7'))});
test('A number also matches a standalone number in the name, but not part of another number',()=>{assert.ok(matchesTeamQuery(team('MonTech 04',null),'04'));assert.ok(!matchesTeamQuery(team('Robot 104',null),'4'))});
test('Text search ignores accents and case and looks at institution and robot',()=>{assert.ok(matchesTeamQuery(team('Águilas',1),'aguilas'));assert.ok(matchesTeamQuery(team('X',1,'Colegio Central'),'CENTRAL'));assert.ok(matchesTeamQuery(team('X',1,'Y','Titan-X'),'titan'));assert.ok(matchesTeamQuery(team('X',1),''))});
test('Teams sort by number ascending, unnumbered last, names break ties',()=>{const list=[team('Zeta',null),team('Beta',10),team('Alfa',2),team('Alfa2',null),team('Gamma',2)];assert.deepEqual(list.sort(byTeamNumber).map(t=>t.name),['Alfa','Gamma','Beta','Alfa2','Zeta'])});
