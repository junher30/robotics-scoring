const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');
const ExcelJS=require('exceljs');
function load(file,deps={}){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:name=>deps[name]??require(name),Intl});return module.exports;}
const {buildEventWorkbook,slug}=load('lib/scoring/export.ts',{exceljs:ExcelJS,'../events/schema':{statusLabels:{ACTIVE:'Activo',DRAFT:'Borrador',FINISHED:'Finalizado',CANCELLED:'Cancelado'}}});
const event={name:'RoboKids 2026',status:'ACTIVE',city:'Neiva',location:null,start_date:'2026-10-01T15:00:00Z',end_date:'2026-10-02T15:00:00Z'};
const board=(teams)=>({has_scores:true,config:null,challenges:[{id:'ch1',name:'Reto 1',sort_order:1},{id:'ch2',name:'Reto 2',sort_order:2}],teams});
async function readBack(workbook){const buf=await workbook.xlsx.writeBuffer();const check=new ExcelJS.Workbook();await check.xlsx.load(buf);return check;}
test('slug turns an event name into a safe filename fragment',()=>{assert.equal(slug('RoboKids Challenge 2026'),'robokids-challenge-2026');assert.equal(slug('   '),'evento');});
test('The summary sheet has the event basics',async()=>{
 const wb=buildEventWorkbook(event,[],iso=>iso,'2026-10-05T00:00:00Z');
 const check=await readBack(wb);
 const summary=check.getWorksheet('Resumen');
 assert.equal(summary.getRow(2).getCell(1).value,'Evento');assert.equal(summary.getRow(2).getCell(2).value,'RoboKids 2026');
 assert.equal(summary.getRow(3).getCell(2).value,'Activo');
});
test('Each category becomes its own sheet with one column per challenge, in order',async()=>{
 const teams=[
  {id:'t1',name:'Equipo Uno',institution:'Colegio A',team_number:1,position_override:null,scored_count:2,total:160,position:1,scores:[{id:'s1',challenge_id:'ch1',attempt:1,seconds:10,completed:true,points:160,notes:'',updated_at:'x'},{id:'s2',challenge_id:'ch2',attempt:0,seconds:0,completed:false,points:0,notes:'',updated_at:'x'}]},
  {id:'t2',name:'Equipo Dos',institution:'Colegio B',team_number:null,position_override:null,scored_count:0,total:null,position:null,scores:[]},
 ];
 const wb=buildEventWorkbook(event,[{category:{id:'c1',name:'Categoría A',status:'ACTIVE'},board:board(teams)}],iso=>iso,'2026-10-05T00:00:00Z');
 const check=await readBack(wb);
 const sheet=check.getWorksheet('Categoría A');
 assert.deepEqual(sheet.getRow(1).values.slice(1),['Posición','#','Equipo','Institución','Reto 1','Reto 2','Puntos totales','Retos calificados']);
 assert.deepEqual(sheet.getRow(2).values.slice(1),[1,1,'Equipo Uno','Colegio A',160,0,160,'2/2']);
 assert.deepEqual(sheet.getRow(3).values.slice(1),['—','—','Equipo Dos','Colegio B','—','—','—','0/2']);
});
test('Category names that are invalid or too long for a sheet name are sanitized',async()=>{
 const wb=buildEventWorkbook(event,[{category:{id:'c1',name:'A'.repeat(40)+':/?*[weird]',status:'ACTIVE'},board:board([])},{category:{id:'c2',name:'Sin equipos aún',status:'ACTIVE'},board:board([])}],iso=>iso,'2026-10-05T00:00:00Z');
 const check=await readBack(wb);
 assert.ok(check.worksheets.every(sheet=>sheet.name.length<=31));
 const empty=check.getWorksheet('Sin equipos aún');
 assert.equal(empty.getRow(2).getCell(1).value,'Sin equipos activos todavía.');
});
test('A category whose board could not be loaded is skipped instead of crashing',async()=>{
 const wb=buildEventWorkbook(event,[{category:{id:'c1',name:'Rota',status:'ACTIVE'},board:null},{category:{id:'c2',name:'Buena',status:'ACTIVE'},board:board([])}],iso=>iso,'2026-10-05T00:00:00Z');
 const check=await readBack(wb);
 assert.equal(check.getWorksheet('Rota'),undefined);
 assert.ok(check.getWorksheet('Buena'));
});
