'use server';
import {z} from 'zod';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireAccess} from '../../lib/auth/authorization';
import {createClient} from '../../lib/supabase/server';
import {scoreSchema,type FormState} from '../../lib/scoring/schema';
export async function saveJudgeScore(eventId:string,teamId:string,challengeId:string,version:string|null,_previous:FormState,form:FormData):Promise<FormState>{
 await requireAccess('judge');
 const values=Object.fromEntries(['attempt','seconds','completed','notes'].map(k=>[k,String(form.get(k)??'')]));const parsed=scoreSchema.safeParse(values);
 if(!parsed.success)return {values,message:'Revisa los campos indicados.',errors:parsed.error.flatten().fieldErrors};
 if(![eventId,teamId,challengeId].every(v=>z.string().uuid().safeParse(v).success)||(version!==null&&!z.string().datetime({offset:true}).safeParse(version).success))return {values,message:'Abre de nuevo el equipo desde tus categorías.'};
 if(version&&!parsed.data.notes)return {values,message:'Explica el motivo de la corrección.',errors:{notes:['Escribe qué estás corrigiendo.']}};
 try{const client=await createClient(),v=parsed.data;const {data,error}=await client.rpc('roboscore_save_score',{p_event:eventId,p_team:teamId,p_challenge:challengeId,p_version:version,p_attempt:Number(v.attempt),p_seconds:Number(v.seconds),p_completed:v.completed==='true',p_notes:v.notes});
  if(error)return {values,message:['42501','22023','40001'].includes(error.code)?error.message:'No se pudo guardar. Revisa la conexión o consulta al organizador.'};
  if(!z.string().uuid().safeParse(data).success)return {values,message:'No pudimos confirmar el resultado. Recarga antes de reintentar.'};
 }catch{return {values,message:'No se pudo confirmar la puntuación. Recarga para comprobar si se guardó.'};}
 revalidatePath('/judge','layout');revalidatePath(`/admin/eventos/${eventId}`,'layout');revalidatePath('/');
 redirect(`/judge/equipos/${teamId}?guardado=1`);
}
