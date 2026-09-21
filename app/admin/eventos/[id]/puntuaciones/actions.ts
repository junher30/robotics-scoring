'use server';
import {z} from 'zod';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireAccess} from '../../../../../lib/auth/authorization';
import {createClient} from '../../../../../lib/supabase/server';
import {configSchema,scoreSchema,type FormState} from '../../../../../lib/scoring/schema';
const uuid=(value:string)=>z.string().uuid().safeParse(value).success;
const message=(error:{code:string;message:string})=>['42501','22023','40001'].includes(error.code)?error.message:'No se pudo guardar. Revisa la conexión y la configuración de puntuaciones.';
export async function configureScoring(eventId:string,categoryId:string,_previous:FormState,form:FormData):Promise<FormState>{
 await requireAccess('admin');const values={rule:String(form.get('rule')??''),count:String(form.get('count')??'')};const parsed=configSchema.safeParse(values);
 if(!parsed.success||!uuid(eventId)||!uuid(categoryId))return {values,message:'Selecciona una regla y entre 1 y 20 retos.'};
 try{const client=await createClient();const {error}=await client.rpc('roboscore_configure_scoring',{p_event:eventId,p_category:categoryId,p_rule:parsed.data.rule,p_count:parsed.data.count});if(error)return {values,message:message(error)};}catch{return {values,message:'No se pudo confirmar la configuración. Recarga antes de reintentar.'};}
 revalidatePath(`/admin/eventos/${eventId}`,'layout');redirect(`/admin/eventos/${eventId}/puntuaciones?categoria=${categoryId}&guardado=1`);
}
export async function saveScore(eventId:string,teamId:string,challengeId:string,version:string|null,_previous:FormState,form:FormData):Promise<FormState>{
 await requireAccess('admin');const values=Object.fromEntries(['attempt','seconds','completed','notes'].map(k=>[k,String(form.get(k)??'')]));const parsed=scoreSchema.safeParse(values);
 if(!parsed.success)return {values,message:'Revisa los campos indicados.',errors:parsed.error.flatten().fieldErrors};
 if(![eventId,teamId,challengeId].every(uuid)||(version!==null&&!z.string().datetime({offset:true}).safeParse(version).success))return {values,message:'Abre de nuevo la ficha del equipo.'};
 if(version&&!parsed.data.notes)return {values,message:'Explica el motivo de la corrección.',errors:{notes:['Escribe qué estás corrigiendo.']}};
 try{const client=await createClient(),v=parsed.data;const {error}=await client.rpc('roboscore_save_score',{p_event:eventId,p_team:teamId,p_challenge:challengeId,p_version:version,p_attempt:Number(v.attempt),p_seconds:Number(v.seconds),p_completed:v.completed==='true',p_notes:v.notes});if(error)return {values,message:message(error)};}catch{return {values,message:'No se pudo confirmar la puntuación. Recarga para comprobar si se guardó.'};}
 revalidatePath(`/admin/eventos/${eventId}`,'layout');redirect(`/admin/eventos/${eventId}/puntuaciones/${teamId}?guardado=1`);
}
