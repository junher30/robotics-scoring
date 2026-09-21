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
