'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireAccess,homeForRole} from '../../../lib/auth/authorization';
import {createClient} from '../../../lib/supabase/server';
import {passwordErrorMessage,passwordSchema,type PasswordState} from '../../../lib/users/password';
export async function savePassword(_previous:PasswordState,form:FormData):Promise<PasswordState> {
  const profile=await requireAccess();
  const parsed=passwordSchema.safeParse({password:form.get('password'),confirmation:form.get('confirmation')});
  if (!parsed.success) return {message:'Revisa la contraseña.',errors:parsed.error.flatten().fieldErrors};
  try {
    const client=await createClient();
    const {error}=await client.auth.updateUser({password:parsed.data.password});
    if (error) { console.error('[crear-clave] updateUser falló:',error.name,error.code,error.status); return {message:passwordErrorMessage(error)}; }
  } catch {return {message:'No pudimos confirmar el cambio. Comprueba tu conexión e intenta nuevamente.'};}
  revalidatePath('/','layout');
  redirect(homeForRole(profile.role));
}
