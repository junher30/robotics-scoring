'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAccess } from '../../../lib/auth/authorization';
import { createClient } from '../../../lib/supabase/server';
import { eventSchema, emptyValues, toPayload, type EventState, type EventValues } from '../../../lib/events/schema';
export async function saveEvent(id:string, version:string|null, _previous:EventState, form:FormData):Promise<EventState> {
  const profile=await requireAccess('admin');
  const values=Object.fromEntries(Object.keys(emptyValues).map(key=>[key,key==='public'?form.get(key)==='on':String(form.get(key)??'')])) as EventValues;
  const parsed=eventSchema.safeParse(values);
  if(!parsed.success)return {values,errors:parsed.error.flatten().fieldErrors,message:'Revisa los campos indicados.'};
  if(!z.string().uuid().safeParse(id).success || (version!==null&&!z.string().datetime({offset:true}).safeParse(version).success)) return {values,message:'La referencia del evento no es válida. Abre el formulario de nuevo.'};
  try {
    const client=await createClient(); const payload=toPayload(parsed.data);
    if(version===null){
      const base=parsed.data.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80).replace(/-$/,'') || 'evento';
      const {error}=await client.from('events').insert({...payload,id,slug:`${base}-${id}`,created_by:profile.id});
      if(error){
        // A retry of this form reuses its UUID; it never inserts a second event.
        if(error.code==='23505'){
          const existing=await client.from('events').select('id').eq('id',id).eq('created_by',profile.id).maybeSingle();
          if(existing.error||!existing.data)return {values,message:'No se pudo crear el evento. Abre el formulario de nuevo.'};
        }else return {values,message:error.code==='42501'?'No pudimos guardar: comprueba tus permisos y la instalación del SQL de la fase 9.':'No se pudo crear el evento. Revisa los datos e inténtalo de nuevo.'};
      }
    }else{
      const {data,error}=await client.from('events').update(payload).eq('id',id).eq('updated_at',version).select('id').maybeSingle();
      if(error)return {values,message:error.code==='42501'?'No tienes permiso para guardar este evento o falta activar la fase 9.':'No se pudieron guardar los cambios. Inténtalo de nuevo.'};
      if(!data)return {values,message:'El evento cambió en otra sesión o ya no tienes acceso. Recarga la página antes de editar; conserva una copia de tus cambios si la necesitas.'};
    }
  } catch{return {values,message:'No se pudo confirmar la operación. Comprueba tu conexión y reintenta con este mismo formulario.'};}
  revalidatePath('/admin'); revalidatePath('/admin/eventos');revalidatePath(`/admin/eventos/${id}`);
  redirect(`/admin/eventos/${id}?resultado=${version===null?'creado':'guardado'}`);
}
