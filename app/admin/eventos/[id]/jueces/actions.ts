'use server';
import {z} from 'zod';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireAccess} from '../../../../../lib/auth/authorization';
import {createClient} from '../../../../../lib/supabase/server';
export type AssignmentState={message?:string};
export async function assignJudge(eventId:string,_previous:AssignmentState,form:FormData):Promise<AssignmentState>{
 await requireAccess('admin');
 const category=String(form.get('category')??''),judge=String(form.get('judge')??''),active=String(form.get('active')??'');
 if(![eventId,category,judge].every(v=>z.string().uuid().safeParse(v).success)||!['true','false'].includes(active))return {message:'Selecciona el juez y la categoría.'};
 try{const client=await createClient();const {data,error}=await client.rpc('roboscore_assign_judge',{p_event:eventId,p_category:category,p_judge:judge,p_active:active==='true'});if(error)return {message:['42501','22023'].includes(error.code)?error.message:'No se pudo guardar. Comprueba que el SQL de calificación de jueces esté instalado.'};if(!z.string().uuid().safeParse(data).success)return {message:'No pudimos confirmar el cambio. Recarga antes de reintentar.'};}catch{return {message:'No se pudo confirmar el cambio. Recarga para revisar las asignaciones.'};}
 revalidatePath(`/admin/eventos/${eventId}`,'layout');revalidatePath('/judge','layout');redirect(`/admin/eventos/${eventId}/jueces?guardado=1`);
}
