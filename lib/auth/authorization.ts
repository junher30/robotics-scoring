import 'server-only';
import { redirect } from 'next/navigation';
import { readAccess, type UserProfile } from './profile';
export type Area = 'admin' | 'judge';
export function homeForRole(role: UserProfile['role']) {
  return role === 'JUDGE' ? '/judge' : '/admin';
}
// Call in every protected page and future data operation, not only in layouts.
export async function requireAccess(area?: Area): Promise<UserProfile> {
  let access;
  try { access = await readAccess(); }
  catch { redirect('/login?aviso=acceso'); }
  if (!access.profile) redirect('/login?aviso=acceso');
  const profile = access.profile;
  if (area && homeForRole(profile.role) !== `/${area}`) {
    redirect(`${homeForRole(profile.role)}?aviso=permisos`);
  }
  return profile;
}
