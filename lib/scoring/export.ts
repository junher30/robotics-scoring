import ExcelJS from 'exceljs';
import {statusLabels,type EventRecord} from '../events/schema';
import type {Board,CategoryOption} from './schema';
const sheetName=(name:string)=>name.replace(/[:\\/?*[\]]/g,' ').slice(0,31)||'Categoría';
export const slug=(name:string)=>name.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'evento';
type CategoryBoard={category:CategoryOption;board:Board|null};
// Pure workbook builder: no framework/session dependency, so it can be unit tested directly.
export function buildEventWorkbook(event:EventRecord,categoryBoards:CategoryBoard[],formatDate:(iso:string)=>string,now:string):ExcelJS.Workbook{
 const workbook=new ExcelJS.Workbook();
 workbook.creator='RoboScore';workbook.created=new Date(now);
 const summary=workbook.addWorksheet('Resumen');
 summary.columns=[{header:'Campo',key:'k',width:20},{header:'Valor',key:'v',width:60}];
 summary.addRows([
  {k:'Evento',v:event.name},
  {k:'Estado',v:statusLabels[event.status]??event.status},
  {k:'Lugar',v:event.city||event.location||'—'},
  {k:'Inicio',v:formatDate(event.start_date)},
  {k:'Fin',v:formatDate(event.end_date)},
  {k:'Categorías',v:String(categoryBoards.length)},
  {k:'Generado',v:formatDate(now)},
 ]);
 summary.getRow(1).font={bold:true};summary.getColumn('k').font={bold:true};
 for(const {category,board} of categoryBoards){
  if(!board)continue;
  const {challenges,teams}=board;
  const sheet=workbook.addWorksheet(sheetName(category.name));
  sheet.columns=[
   {header:'Posición',key:'position',width:10},
   {header:'#',key:'number',width:6},
   {header:'Equipo',key:'name',width:28},
   {header:'Institución',key:'institution',width:30},
   ...challenges.map(c=>({header:c.name,key:`c_${c.id}`,width:12})),
   {header:'Puntos totales',key:'total',width:14},
   {header:'Retos calificados',key:'scored',width:16},
  ];
  sheet.getRow(1).font={bold:true};
  for(const team of teams){
   const row:Record<string,string|number>={position:team.position??'—',number:team.team_number??'—',name:team.name,institution:team.institution,total:team.total??'—',scored:`${team.scored_count}/${challenges.length}`};
   for(const challenge of challenges){
    const found=team.scores.find(s=>s.challenge_id===challenge.id);
    row[`c_${challenge.id}`]=found?Number(found.points):'—';
   }
   sheet.addRow(row);
  }
  if(!teams.length)sheet.addRow({position:'Sin equipos activos todavía.'});
 }
 return workbook;
}
