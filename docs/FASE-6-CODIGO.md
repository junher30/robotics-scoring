# Código completo — fase 6

## proxy.ts

```tsx
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { authConfig, authFetch, REMEMBER_COOKIE, sessionCookieOptions } from './lib/auth/config';
// Solo renovación de sesión. La autorización se comprueba en el servidor.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set('Cache-Control', 'private, no-store');
  try {
    const { url, key } = authConfig();
    const remember = request.cookies.get(REMEMBER_COOKIE)?.value === 'yes';
    const supabase = createServerClient(url, key, {
      global: { fetch: authFetch },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(items) {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          response.headers.set('Cache-Control', 'private, no-store');
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, sessionCookieOptions(options, remember)));
        },
      },
    });
    await supabase.auth.getClaims();
  } catch { /* La página y la acción validan acceso; un fallo nunca lo concede. */ }
  return response;
}
export const config = { matcher: ['/login', '/cuenta'] };

```

## lib/auth/config.ts

```tsx
import type { CookieOptions } from '@supabase/ssr';
export const REMEMBER_COOKIE = 'roboscore-remember';
export const REMEMBER_SECONDS = 60 * 60 * 24 * 30;
export function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Falta la configuración pública de Supabase.');
  return { url, key };
}
export function sessionCookieOptions(options: CookieOptions, remember: boolean): CookieOptions {
  return { ...options, path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    maxAge: options.maxAge === 0 ? 0 : remember ? REMEMBER_SECONDS : undefined,
    expires: options.maxAge === 0 ? new Date(0) : undefined };
}
export const authFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store', signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });

```

## lib/auth/profile.ts

```tsx
import 'server-only';
import { z } from 'zod';
import { createClient } from '../supabase/server';
export const profileSchema = z.object({ id: z.string().uuid(), email: z.string().nullable(), first_name: z.string(), last_name: z.string(), role: z.enum(['SUPER_ADMIN','ADMIN','JUDGE']), active: z.boolean() });
export type UserProfile = z.infer<typeof profileSchema>;
export async function readAccess() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { profile: null, reason: 'session' } as const;
  const { data, error: profileError } = await supabase.from('profiles').select('id,email,first_name,last_name,role,active').eq('id', user.id).single();
  const result = profileSchema.safeParse(data);
  if (profileError || !result.success) return { profile: null, reason: 'profile' } as const;
  if (!result.data.active) return { profile: null, reason: 'inactive' } as const;
  return { profile: result.data, reason: null } as const;
}

```

## lib/auth/validation.ts

```tsx
import { z } from 'zod';
export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Escribe tu correo.').max(254, 'El correo es demasiado largo.').email('Escribe un correo válido.'),
  password: z.string().min(1, 'Escribe tu contraseña.').max(256, 'La contraseña es demasiado larga.'),
  remember: z.boolean(),
});
export type LoginState = { message?: string; errors?: { email?: string[]; password?: string[] }; email?: string; remember?: boolean };

```

## lib/supabase/server.ts

```tsx
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { authConfig, authFetch, REMEMBER_COOKIE, sessionCookieOptions } from '../auth/config';
export async function createClient(rememberOverride?: boolean) {
  const store = await cookies();
  const { url, key } = authConfig();
  const remember = rememberOverride ?? store.get(REMEMBER_COOKIE)?.value === 'yes';
  return createServerClient(url, key, {
    global: { fetch: authFetch },
    cookies: {
      getAll: () => store.getAll(),
      setAll(items) {
        try { items.forEach(({ name, value, options }) => store.set(name, value, sessionCookieOptions(options, remember))); }
        catch { /* Server Components solo leen; proxy.ts renueva las cookies. */ }
      },
    },
  });
}

```

## app/login/actions.ts

```tsx
'use server';
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
    const store = await cookies();
    store.set(REMEMBER_COOKIE, parsed.data.remember ? 'yes' : 'no', sessionCookieOptions({}, parsed.data.remember));
  } catch {
    await clearLocalSession();
    return { ...safeState, message: 'No pudimos completar la conexión. Comprueba tu conexión e inténtalo otra vez.' };
  }
  revalidatePath('/', 'layout');
  redirect('/cuenta');
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

```

## app/login/login-form.tsx

```tsx
'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { login } from './actions';
import type { LoginState } from '../../lib/auth/validation';
import styles from './login.module.css';
export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [visible, setVisible] = useState(false);
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state.message || state.errors) notice.current?.focus(); }, [state]);
  return <form action={action} className={styles.form} noValidate aria-busy={pending}>
    {(state.message || state.errors) && <div ref={notice} tabIndex={-1} className={styles.error} role="alert">{state.message ?? 'Revisa los campos indicados para continuar.'}</div>}
    <div className={styles.field}><label htmlFor="email">Correo electrónico</label><input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="tu@correo.com" defaultValue={state.email ?? ''} maxLength={254} required aria-invalid={Boolean(state.errors?.email)} aria-describedby={state.errors?.email ? 'email-error' : undefined} disabled={pending}/>{state.errors?.email && <p id="email-error" className={styles.fieldError}>{state.errors.email[0]}</p>}</div>
    <div className={styles.field}><label htmlFor="password">Contraseña</label><div className={styles.password}><input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Tu contraseña" maxLength={256} required aria-invalid={Boolean(state.errors?.password)} aria-describedby={state.errors?.password ? 'password-error' : undefined} disabled={pending}/><button type="button" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible} onClick={()=>setVisible(!visible)} disabled={pending}>{visible ? 'Ocultar' : 'Mostrar'}</button></div>{state.errors?.password && <p id="password-error" className={styles.fieldError}>{state.errors.password[0]}</p>}</div>
    <label className={styles.remember}><input type="checkbox" name="remember" defaultChecked={state.remember ?? false} disabled={pending}/><span>Recordarme en este dispositivo</span></label>
    <button type="submit" className={styles.submit} disabled={pending}>{pending ? 'Iniciando sesión…' : 'Iniciar sesión'}<span aria-hidden="true">{pending ? '…' : '→'}</span></button>
    <p className={styles.note}>Si compartes este dispositivo, deja “Recordarme” desmarcado y cierra sesión al terminar.</p>
  </form>;
}

```

## app/login/login.module.css

```css
.screen{min-height:100svh;background:#f7f8fa;padding:32px;display:grid;place-items:center;color:#202b3b}.shell{width:min(1100px,100%);min-height:720px;display:grid;grid-template-columns:.95fr 1.05fr;background:white;border:1px solid #e7e9ed;border-radius:26px;overflow:hidden;box-shadow:0 20px 65px #24324808}.story{background:#f9e4df;padding:42px;display:flex;flex-direction:column;justify-content:space-between;gap:48px}.brand{display:inline-flex;align-items:center;gap:10px;font-size:23px;font-weight:800;letter-spacing:-1px;width:fit-content}.brand>span{display:grid;place-items:center;width:36px;height:36px;background:#dc343b;color:white;border-radius:10px;font-size:22px;transform:rotate(-5deg)}.eyebrow{font-size:11px;letter-spacing:.1em;font-weight:750;color:#a44a49;margin-bottom:22px}.story h1{font-size:clamp(40px,4.4vw,57px);line-height:1.08;font-weight:800;letter-spacing:-.05em}.story h1 em{font-style:normal;color:#ce343e}.storyText{font-size:16px;line-height:1.8;margin-top:25px;color:#8f6762;max-width:320px}.storyFooter{display:flex;justify-content:space-between;gap:16px;font-size:11px;color:#98736e;border-top:1px solid #e9c6bf;padding-top:20px}.content{padding:35px 48px;display:flex;flex-direction:column;justify-content:space-between;gap:25px}.back{display:inline-flex;align-items:center;min-height:44px;font-size:13px;color:#6b7584;width:fit-content}.back:hover{color:#b91c1c}.card{padding-block:20px}.kicker{font-size:11px;letter-spacing:.1em;font-weight:750;color:#b34b4d}.card h2{font-size:34px;font-weight:800;letter-spacing:-.045em;margin:10px 0 12px;line-height:1.2}.description{color:#707b8a;font-size:15px;line-height:1.75}.form{display:flex;flex-direction:column;gap:21px;margin-top:29px}.field{display:flex;flex-direction:column;gap:8px}.field label{font-size:14px;font-weight:650}.field input{width:100%;min-height:50px;border:1px solid #dfe3e9;border-radius:10px;background:#fff;padding:12px 14px;font-size:16px;color:#202b3b;min-width:0}.field input::placeholder{color:#939ca9}.field input[aria-invalid=true]{border-color:#b91c1c}.password{position:relative}.password input{padding-right:86px}.password button{position:absolute;right:4px;top:3px;bottom:3px;padding:0 12px;border:0;background:transparent;color:#8b4246;font-size:12px;font-weight:650;border-radius:8px}.remember{display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;min-height:32px}.remember input{width:18px;height:18px;accent-color:#dc343b;flex-shrink:0}.submit{display:flex;align-items:center;justify-content:center;gap:20px;width:100%;min-height:50px;padding:13px 18px;border:0;background:#d9323a;color:white;border-radius:11px;font-size:15px;font-weight:700;transition:background .2s}.submit:hover{background:#bd2730}.submit:disabled{opacity:.65;cursor:wait}.note{font-size:12px;line-height:1.6;color:#85909e;margin-top:-8px}.help{border-top:1px solid #eceef2;margin-top:25px;padding-top:17px;font-size:13px;color:#6e7785}.help summary{cursor:pointer;padding-block:7px;font-weight:600}.help p{margin-top:12px;line-height:1.8}.footer{font-size:11px;color:#929aa6;text-align:center}.error,.success{padding:13px 15px;border-radius:10px;font-size:14px;line-height:1.6;margin-top:16px}.error{background:#fff1f0;color:#a42830;border:1px solid #f6d0cd}.success{background:#eef9f2;color:#276445;border:1px solid #d3ebdd}.form .error{margin-top:0}.fieldError{font-size:13px;color:#b91c1c}.accountScreen{min-height:100svh;display:grid;place-items:center;background:#f8fafc;padding:24px}.accountCard{width:min(510px,100%);background:#fff;border:1px solid #e2e8f0;border-radius:22px;padding:35px;box-shadow:0 15px 45px #1e293b08}.accountCard h1{margin-top:24px;font-size:34px;letter-spacing:-.04em;font-weight:750}.accountCard form{margin-top:26px}.accountCard>.back{margin-top:16px}.profile{margin:25px 0;border-block:1px solid #edf0f3;padding:12px 0}.profile>div{display:flex;justify-content:space-between;gap:18px;padding-block:9px;font-size:14px}.profile dt{color:#7b8593}.profile dd{margin:0;font-weight:650;overflow-wrap:anywhere;text-align:right}.screen a:focus-visible,.screen button:focus-visible,.screen input:focus-visible,.screen summary:focus-visible,.accountScreen a:focus-visible,.accountScreen button:focus-visible{outline:3px solid #b91c1c;outline-offset:3px}@media(max-width:850px){.screen{padding:20px}.story{padding:30px}.content{padding:30px}.story h1{font-size:43px}.storyFooter{flex-direction:column;gap:6px}.shell{min-height:700px}}@media(max-width:650px){.screen{padding:0;display:block;background:white}.shell{display:flex;flex-direction:column;border:0;border-radius:0;min-height:100svh}.story{padding:23px 24px;gap:0}.story>div,.storyFooter{display:none}.brand{font-size:22px}.content{padding:12px 24px 25px;gap:14px;flex:1}.card{padding:12px 0 22px}.card h2{font-size:32px}.form{margin-top:25px}.footer{font-size:12px}.accountScreen{padding:16px}.accountCard{padding:25px 20px}.profile>div{flex-direction:column;gap:3px}.profile dd{text-align:left}}@media(prefers-reduced-motion:reduce){.submit{transition:none}}

```

## app/login/page.tsx

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { readAccess } from '../../lib/auth/profile';
import { LoginForm } from './login-form';
import styles from './login.module.css';
export const metadata: Metadata = { title: 'Iniciar sesión | RoboScore', robots: { index: false, follow: false } };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ salida?: string; aviso?: string }> }) {
  let connectionError = false;
  let hasAccess = false;
  try { hasAccess = Boolean((await readAccess()).profile); } catch { connectionError = true; }
  if (hasAccess) redirect('/cuenta');
  const params = await searchParams;
  return <main className={styles.screen}><div className={styles.shell}>
    <aside className={styles.story}><Link href="/" className={styles.brand}><span>R</span>RoboScore.</Link><div><p className={styles.eyebrow}>EL TALENTO NECESITA UN BUEN EQUIPO</p><h1>Detrás de cada<br/>gran reto,<br/><em>estás tú.</em></h1><p className={styles.storyText}>Tu espacio para acompañar a quienes construyen el futuro.</p></div><div className={styles.storyFooter}><span>01 / ACCESO</span><span>Crear. Aprender. Competir.</span></div></aside>
    <section className={styles.content} aria-labelledby="login-title"><Link href="/" className={styles.back}>← Volver a RoboScore</Link><div className={styles.card}><span className={styles.kicker}>BIENVENIDO A ROBOSCORE</span><h2 id="login-title">Qué bueno verte.</h2><p className={styles.description}>Ingresa con la cuenta que te asignó tu organizador.</p>
      {params.salida === '1' && <p role="status" className={styles.success}>Cerraste sesión en este dispositivo.</p>}
      {params.aviso === 'acceso' && <p role="alert" className={styles.error}>Inicia sesión con una cuenta activa para continuar.</p>}
      {connectionError && <p role="alert" className={styles.error}>No pudimos conectar con el servicio. Inténtalo de nuevo en unos momentos.</p>}
      <LoginForm/>
      <details className={styles.help}><summary>¿Olvidaste tu contraseña o no tienes cuenta?</summary><p>Contacta al administrador de tu evento para recuperar el acceso o solicitar una cuenta. El registro público está cerrado.</p></details>
    </div><p className={styles.footer}>RoboScore · Un lugar para construir el futuro.</p></section>
  </div></main>;
}

```

## app/cuenta/logout-button.tsx

```tsx
'use client';
import { useFormStatus } from 'react-dom';
import { logout } from '../login/actions';
import styles from '../login/login.module.css';
function Button() { const { pending } = useFormStatus(); return <button className={styles.submit} disabled={pending}>{pending ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>; }
export function LogoutButton() { return <form action={logout}><Button/></form>; }

```

## app/cuenta/page.tsx

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { readAccess } from '../../lib/auth/profile';
import { LogoutButton } from './logout-button';
import styles from '../login/login.module.css';
export const metadata: Metadata = { title: 'Mi sesión | RoboScore', robots: { index: false, follow: false } };
export default async function AccountPage() {
  let access;
  try { access = await readAccess(); } catch { redirect('/login?aviso=acceso'); }
  if (!access.profile) redirect('/login?aviso=acceso');
  const profile = access.profile;
  const labels = { SUPER_ADMIN: 'Superadministrador', ADMIN: 'Administrador', JUDGE: 'Juez' };
  return <main className={styles.accountScreen}><section className={styles.accountCard}><Link href="/" className={styles.brand}><span>R</span>RoboScore.</Link><p className={styles.success} role="status">Sesión iniciada correctamente</p><h1>Hola{profile.first_name ? `, ${profile.first_name}` : ''}.</h1><p className={styles.description}>Tu acceso a RoboScore está listo.</p><dl className={styles.profile}><div><dt>Correo</dt><dd>{profile.email}</dd></div><div><dt>Rol</dt><dd>{labels[profile.role]}</dd></div><div><dt>Cuenta</dt><dd>Activa</dd></div></dl><p className={styles.description}>Los paneles de administración y jueces se habilitarán en las próximas fases.</p><LogoutButton/><Link href="/" className={styles.back}>← Volver a la página principal</Link></section></main>;
}

```