'use server';
import {redirect} from 'next/navigation';
import {createClient} from '../../../lib/supabase/server';
export type SessionState={message?:string};
// The default Supabase email confirms the invitation before returning a session
// in the URL fragment. Validate that session with Auth before granting access.
export async function acceptInvitationSession(accessToken:string,refreshToken:string,_previous:SessionState):Promise<SessionState>{
 void _previous;
 if(typeof accessToken!=='string'||typeof refreshToken!=='string'||!accessToken||!refreshToken||accessToken.length>16000||refreshToken.length>4096)return {message:'El enlace está incompleto. Abre de nuevo el correo de invitación.'};
 try{
  const client=await createClient(false);
  const {data:session,error:sessionError}=await client.auth.setSession({access_token:accessToken,refresh_token:refreshToken});
  if(sessionError||!session.session){await client.auth.signOut({scope:'local'});return {message:'No pudimos recuperar la sesión de invitación. El enlace puede haber vencido.'};}
  const {data,error}=await client.auth.getUser();
  if(error||!data.user||!data.user.invited_at){await client.auth.signOut({scope:'local'});return {message:'No pudimos verificar la cuenta invitada. Contacta al organizador.'};}
  const profile=await client.from('profiles').select('active').eq('id',data.user.id).single();
  if(profile.error||!profile.data?.active){await client.auth.signOut({scope:'local'});return {message:'Tu cuenta está confirmada, pero su perfil no está habilitado. El organizador debe revisar el estado de tu usuario.'};}
 }catch{return {message:'No pudimos conectar con el servicio. Intenta continuar otra vez.'};}
 redirect('/cuenta/crear-clave');
}
