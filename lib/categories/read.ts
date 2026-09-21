import 'server-only';
import { z } from 'zod';
import { notFound } from 'next/navigation';
import { requireAccess } from '../auth/authorization';
import { readEvent } from '../events/read';
import { createClient } from '../supabase/server';
import type { CategoryRecord } from './schema';

export const categoryColumns = 'id,event_id,name,description,max_teams,sort_order,status,updated_at';
export async function categoryEvent(eventId: string) {
  await requireAccess('admin');
  if (!z.string().uuid().safeParse(eventId).success) notFound();
  const { data, error } = await readEvent(eventId);
  if (error) throw new Error('No se pudo consultar el evento.');
  if (!data) notFound();
  return data;
}
export async function readCategory(eventId: string, categoryId: string) {
  await requireAccess('admin');
  if (!z.string().uuid().safeParse(categoryId).success || !z.string().uuid().safeParse(eventId).success) notFound();
  const client = await createClient();
  const { data, error } = await client.from('event_categories').select(categoryColumns)
    .eq('event_id', eventId).eq('id', categoryId).maybeSingle<CategoryRecord>();
  if (error) throw new Error('No se pudo consultar la categoría.');
  if (!data) notFound();
  return data;
}
