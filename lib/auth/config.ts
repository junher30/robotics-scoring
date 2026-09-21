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
