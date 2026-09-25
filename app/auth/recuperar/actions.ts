'use server';
import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {authConfig,authFetch} from '../../../lib/auth/config';
import {invitationConfig} from '../../../lib/supabase/admin';
export type RecoverState={message?:string;error?:string;email?:string};
const emailSchema=z.string().trim().min(1).max(254).email();
// Same answer whether or not the address has an account, so this form can't be used to discover who is registered.
export async function requestPasswordReset(_previous:RecoverState,form:FormData):Promise<RecoverState>{
 void _previous;
 const raw=String(form.get('email')??'');const parsed=emailSchema.safeParse(raw);
 if(!parsed.success)return {email:raw.slice(0,254),error:'Escribe un correo válido.'};
 try{
  const {url,key}=authConfig();const {redirectTo}=invitationConfig();
  // The implicit flow puts the session in the link's URL fragment, which the invitation session bridge already handles.
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,flowType:'implicit'},global:{fetch:authFetch}});
  const {error}=await client.auth.resetPasswordForEmail(parsed.data,{redirectTo});
  if(error){
   console.error('[recuperar] resetPasswordForEmail falló:',error.name,error.code,error.status);
   if(error.status===429)return {email:parsed.data,error:'Ya enviamos un enlace hace poco. Espera un minuto antes de pedir otro.'};
   return {email:parsed.data,error:'No pudimos enviar el enlace en este momento. Inténtalo de nuevo en unos minutos.'};
  }
 }catch{return {email:parsed.data,error:'No pudimos conectar con el servicio. Inténtalo de nuevo en unos minutos.'};}
 return {email:parsed.data,message:'Si ese correo tiene una cuenta activa, te enviamos un enlace para crear tu contraseña. Revisa también la carpeta de spam.'};
}
