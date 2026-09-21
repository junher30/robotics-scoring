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
export const config = { matcher: ['/login', '/cuenta/:path*', '/auth/:path*', '/admin/:path*', '/judge/:path*'] };
