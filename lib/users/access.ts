import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAccess } from '../auth/authorization';
import { createClient } from '../supabase/server';
import type { ManagedUser } from './schema';
export const userColumns = 'id,first_name,last_name,email,phone,role,active,managed_by,created_at,updated_at';
export async function requireUserManager(superOnly = false) {
  const actor = await requireAccess('admin');
  if (superOnly && actor.role !== 'SUPER_ADMIN') redirect('/admin?aviso=permisos');
  return actor;
}
export async function readManagedUser(id: string) {
  const actor = await requireUserManager();
  if (!z.string().uuid().safeParse(id).success) notFound();
  const client = await createClient();
  const { data,error } = await client.from('profiles').select(userColumns).eq('id',id).maybeSingle<ManagedUser>();
  if (error) throw new Error('No se pudo consultar la cuenta.');
  if (!data || (actor.role !== 'SUPER_ADMIN' && (data.role !== 'JUDGE' || data.managed_by !== actor.id))) notFound();
  return { actor,user:data };
}
