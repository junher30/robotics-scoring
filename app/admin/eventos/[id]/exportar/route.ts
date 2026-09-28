import 'server-only';
import {requireAccess} from '../../../../../lib/auth/authorization';
import {readEvent} from '../../../../../lib/events/read';
import {createClient} from '../../../../../lib/supabase/server';
import {buildEventWorkbook,slug} from '../../../../../lib/scoring/export';
import type {Board,CategoryOption} from '../../../../../lib/scoring/schema';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const formatDate=(iso:string)=>new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',dateStyle:'medium',timeStyle:'short'}).format(new Date(iso));
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 // Only ADMIN/SUPER_ADMIN reach this area at all; readEvent below is further scoped by
 // RLS to events this specific admin manages (created_by, shared_with_admins or super admin).
 await requireAccess('admin');
 const {id}=await params;
 if(!uuid.test(id))return new Response('Evento no disponible.',{status:404});
 const {data:event,error}=await readEvent(id);
 if(error)return new Response('No pudimos consultar el evento.',{status:500});
 if(!event)return new Response('Evento no disponible.',{status:404});
 const client=await createClient();
 const {data:categories,error:categoriesError}=await client.from('event_categories').select('id,name,status').eq('event_id',id).order('sort_order').order('id').returns<CategoryOption[]>();
 if(categoriesError)return new Response('No pudimos consultar las categorías.',{status:500});
 const categoryBoards=await Promise.all((categories??[]).map(async category=>{
  const {data:board}=await client.rpc('roboscore_scoring_board',{p_event:id,p_category:category.id});
  return {category,board:board as Board|null};
 }));
 const workbook=buildEventWorkbook(event,categoryBoards,formatDate,new Date().toISOString());
 const buffer=await workbook.xlsx.writeBuffer();
 return new Response(buffer,{headers:{
  'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'Content-Disposition':`attachment; filename="${slug(event.name)}-resultados.xlsx"`,
  'Cache-Control':'no-store',
 }});
}
