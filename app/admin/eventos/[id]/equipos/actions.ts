'use server';
import {z} from 'zod';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireAccess} from '../../../../../lib/auth/authorization';
import {createClient} from '../../../../../lib/supabase/server';
import {teamSchema,type FormState} from '../../../../../lib/scoring/schema';
export async function saveTeam(eventId:string,id:string,version:string|null,_previous:FormState,form:FormData):Promise<FormState>{
 await requireAccess('admin');
 const values=Object.fromEntries(['category_id','name','institution','robot_name','active'].map(key=>[key,String(form.get(key)??'')]));
 const parsed=teamSchema.safeParse(values);
 if(!parsed.success)return {values,message:'Revisa los campos indicados.',errors:parsed.error.flatten().fieldErrors};
 if(![eventId,id].every(v=>z.string().uuid().safeParse(v).success)||(version!==null&&!z.string().datetime({offset:true}).safeParse(version).success))return {values,message:'Abre de nuevo el formulario.'};
 try{const client=await createClient(),v=parsed.data;const {data,error}=await client.rpc('roboscore_save_team',{p_event:eventId,p_id:id,p_version:version,p_category:v.category_id,p_name:v.name,p_institution:v.institution,p_robot:v.robot_name,p_active:v.active==='true'});
 if(error)return {values,message:['42501','22023','23505','40001'].includes(error.code)?error.message:'No se pudo guardar. Revisa la conexión y el SQL de equipos.'};if(data!==id)return {values,message:'No se pudo confirmar el guardado. Recarga el listado.'};
 }catch{return {values,message:'No pudimos confirmar la operación. Conserva los datos y revisa el listado antes de reintentar.'};}
 revalidatePath(`/admin/eventos/${eventId}`,'layout');revalidatePath('/admin');redirect(`/admin/eventos/${eventId}/equipos/${id}?guardado=1`);
}
