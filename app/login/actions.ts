'use server';
import { homeForRole } from '../../lib/auth/authorization';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase/server';
import { profileSchema } from '../../lib/auth/profile';
import { authConfig, REMEMBER_COOKIE, sessionCookieOptions } from '../../lib/auth/config';
import { loginSchema, type LoginState } from '../../lib/auth/validation';

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const values = { email: String(formData.get('email') ?? ''), password: String(formData.get('password') ?? ''), remember: formData.get('remember') === 'on' };
  const parsed = loginSchema.safeParse(values);
  const safeState = { email: values.email.slice(0,254), remember: values.remember };
  if (!parsed.success) return { ...safeState, errors: parsed.error.flatten().fieldErrors };
  let destination = '/cuenta';
  try {
    const supabase = await createClient(parsed.data.remember);
    const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
    if (error || !data.user) return { ...safeState, message: error?.status === 429 ? 'Demasiados intentos. Espera unos minutos y vuelve a intentar.' : (error?.status ?? 0) >= 500 ? 'No pudimos conectar con Supabase. Intenta de nuevo en unos momentos.' : 'No pudimos iniciar sesión. Revisa el correo y la contraseña; tu correo debe estar confirmado.' };
    const { data: record, error: profileError } = await supabase.from('profiles').select('id,email,first_name,last_name,role,active').eq('id', data.user.id).single();
    const profile = profileSchema.safeParse(record);
    if (profileError || !profile.success || !profile.data.active) {
      await supabase.auth.signOut({ scope: 'local' });
      await clearLocalSession();
      return { ...safeState, message: profile.success && !profile.data.active ? 'Tu cuenta está desactivada. Contacta al administrador.' : 'No pudimos comprobar tu perfil de RoboScore. Contacta al administrador.' };
    }
    destination = homeForRole(profile.data.role);
    const store = await cookies();
    store.set(REMEMBER_COOKIE, parsed.data.remember ? 'yes' : 'no', sessionCookieOptions({}, parsed.data.remember));
  } catch {
    await clearLocalSession();
    return { ...safeState, message: 'No pudimos completar la conexión. Comprueba tu conexión e inténtalo otra vez.' };
  }
  revalidatePath('/', 'layout');
  redirect(destination);
}

async function clearLocalSession() {
  const store = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url) {
    const prefix = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
    store.getAll().filter(cookie => cookie.name === prefix || cookie.name.startsWith(`${prefix}.`)).forEach(cookie => store.set(cookie.name, '', sessionCookieOptions({ maxAge: 0 }, false)));
  }
  store.set(REMEMBER_COOKIE, '', sessionCookieOptions({ maxAge: 0 }, false));
}
export async function logout() {
  try { authConfig(); const supabase = await createClient(); await supabase.auth.signOut({ scope: 'local' }); }
  catch { /* Se elimina la sesión local incluso si Auth no responde. */ }
  await clearLocalSession();
  revalidatePath('/', 'layout');
  redirect('/login?salida=1');
}
