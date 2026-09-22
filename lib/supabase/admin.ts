import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { authConfig, authFetch } from '../auth/config';
import { BASE_PATH } from '../base-path';
export function invitationConfig() {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const site = process.env.ROBOSCORE_SITE_URL;
  if (!secret || !site) throw new Error('Falta configurar el servicio de invitaciones.');
  const url = new URL(site);
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '') ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname)))) {
    throw new Error('La dirección de RoboScore no es válida.');
  }
  return { secret, redirectTo: `${url.origin}${BASE_PATH}/auth/invitacion` };
}
export function invitationsReady() {
  try { invitationConfig(); return true; } catch { return false; }
}
// No reutiliza cookies ni sesiones. Este cliente solo se utiliza para Auth Admin.
export function createAdminClient() {
  const { url } = authConfig();
  const { secret } = invitationConfig();
  return createClient(url,secret,{ auth:{ persistSession:false,autoRefreshToken:false,detectSessionInUrl:false },global:{ fetch:authFetch } });
}
