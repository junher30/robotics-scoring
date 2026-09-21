'use server';
import {z} from 'zod';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireUserManager} from '../../../lib/users/access';
import {createClient} from '../../../lib/supabase/server';
export type DeleteJudgeState={message?:string};
export async function deleteJudge(id:string,version:string,_previous:DeleteJudgeState,form:FormData):Promise<DeleteJudgeState>{
 const actor=await requireUserManager();
 if(!z.string().uuid().safeParse(id).success||!z.string().datetime({offset:true}).safeParse(version).success||actor.id===id)return {message:'Abre de nuevo la ficha del juez que quieres eliminar.'};
 if(form.get('confirm')!=='yes')return {message:'Confirma que deseas eliminar a este juez.'};
 try{
  const client=await createClient();
  const {data,error}=await client.rpc('roboscore_delete_judge',{p_id:id,p_version:version});
  if(error)return {message:['42501','40001','22023'].includes(error.code)?error.message:error.code==='PGRST202'?'Falta activar la eliminación de jueces en Supabase. Ejecuta el SQL de esta funcionalidad.':'No pudimos eliminar el juez. Revisa la conexión e inténtalo de nuevo.'};
  if(data!==id)return {message:'No pudimos confirmar la eliminación. Recarga el listado antes de reintentar.'};
 }catch{return {message:'No pudimos confirmar la eliminación. Recarga el listado antes de reintentar.'};}
 revalidatePath('/admin','layout');revalidatePath('/judge','layout');revalidatePath('/cuenta','layout');
 redirect('/admin/jueces?resultado=eliminado');
}
