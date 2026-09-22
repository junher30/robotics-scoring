'use server';
import {z} from 'zod';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireAccess} from '../../../../lib/auth/authorization';
import {createClient} from '../../../../lib/supabase/server';
export type DeleteEventState={message?:string};
export async function deleteEvent(id:string,_previous:DeleteEventState,form:FormData):Promise<DeleteEventState>{
 const actor=await requireAccess('admin');
 if(actor.role!=='SUPER_ADMIN')return {message:'Solo el superadministrador puede eliminar eventos.'};
 if(!z.string().uuid().safeParse(id).success)return {message:'Abre de nuevo la ficha del evento.'};
 if(form.get('confirm')!=='yes')return {message:'Confirma que deseas eliminar este evento.'};
 try{
  const client=await createClient();
  const {data,error}=await client.rpc('roboscore_delete_event',{p_event:id});
  if(error)return {message:['42501','22023'].includes(error.code)?error.message:error.code==='PGRST202'?'Falta activar el borrado de eventos en Supabase. Ejecuta el SQL de esta funcionalidad.':'No pudimos eliminar el evento. Revisa la conexión e inténtalo de nuevo.'};
  if(data!==id)return {message:'No pudimos confirmar la eliminación. Recarga el listado antes de reintentar.'};
 }catch{return {message:'No pudimos confirmar la eliminación. Recarga el listado antes de reintentar.'};}
 revalidatePath('/admin','layout');revalidatePath('/admin/eventos','layout');
 redirect('/admin/eventos?resultado=eliminado');
}
