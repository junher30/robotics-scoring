'use server';
import {redirect} from 'next/navigation';
import {createClient} from '../../../lib/supabase/server';
export type AcceptState={message?:string};
export async function acceptInvitation(token:string,_previous:AcceptState):Promise<AcceptState> {
  void _previous;
  if (!/^[a-f0-9]{40,128}$/i.test(token)) return {message:'El enlace no es válido. Solicita una nueva invitación al organizador.'};
  try {
    const client=await createClient(false);
    const {data,error}=await client.auth.verifyOtp({token_hash:token,type:'invite'});
    if (error) console.error('[invitacion] verifyOtp falló:',error.name,error.code,error.status);
    if (error||!data.user) return {message:'El enlace venció o ya fue utilizado. Si ya creaste tu contraseña, inicia sesión. Si no, pide al organizador una nueva invitación.'};
    const profile=await client.from('profiles').select('active').eq('id',data.user.id).single();
    if (profile.error||!profile.data?.active) {
      await client.auth.signOut({scope:'local'});
      return {message:'La cuenta no está habilitada. Contacta al organizador.'};
    }
  } catch {return {message:'No pudimos confirmar el acceso. Inténtalo nuevamente.'};}
  redirect('/cuenta/crear-clave');
}
