'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAccess } from '../../../../../lib/auth/authorization';
import { createClient } from '../../../../../lib/supabase/server';
import { categorySchema, categoryPayload, type CategoryState, type CategoryValues } from '../../../../../lib/categories/schema';

export async function saveCategory(eventId: string, categoryId: string, version: string | null, _previous: CategoryState, form: FormData): Promise<CategoryState> {
  await requireAccess('admin');
  const values: CategoryValues = {
    name: String(form.get('name') ?? ''), description: String(form.get('description') ?? ''),
    max_teams: String(form.get('max_teams') ?? ''), sort_order: String(form.get('sort_order') ?? ''),
    status: String(form.get('status') ?? '') as CategoryValues['status'],
  };
  const parsed = categorySchema.safeParse(values);
  if (!parsed.success) return { values, message: 'Revisa los campos indicados.', errors: parsed.error.flatten().fieldErrors };
  if (![eventId, categoryId].every(id => z.string().uuid().safeParse(id).success) ||
      (version !== null && !z.string().datetime({ offset: true }).safeParse(version).success)) {
    return { values, message: 'La referencia no es válida. Abre de nuevo el formulario.' };
  }
  const duplicate = { values, message: 'Ya existe una categoría con ese nombre en este evento.', errors: { name: ['Usa un nombre diferente, incluso si la otra categoría está cerrada.'] } };
  try {
    const client = await createClient();
    const parent = await client.from('events').select('id').eq('id', eventId).maybeSingle();
    if (parent.error || !parent.data) return { values, message: 'No se pudo comprobar tu acceso al evento. Actualiza la página e inténtalo de nuevo.' };
    const payload = categoryPayload(parsed.data);
    if (version === null) {
      const { error } = await client.from('event_categories').insert({ ...payload, id: categoryId, event_id: eventId });
      if (error) {
        if (error.code !== '23505') return { values, message: 'No se pudo crear la categoría. Comprueba tus permisos y la configuración de categorías.' };
        const existing = await client.from('event_categories').select('id').eq('event_id', eventId).eq('id', categoryId).maybeSingle();
        if (existing.error) return { values, message: 'No se pudo confirmar la creación. Intenta de nuevo con este mismo formulario.' };
        if (!existing.data) return duplicate;
      }
    } else {
      const { data, error } = await client.from('event_categories').update(payload)
        .eq('event_id', eventId).eq('id', categoryId).eq('updated_at', version).select('id').maybeSingle();
      if (error?.code === '23505') return duplicate;
      if (error) return { values, message: 'No se pudieron guardar los cambios. Comprueba tus permisos y vuelve a intentar.' };
      if (!data) return { values, message: 'La categoría cambió en otra sesión o ya no tienes acceso. Conserva una copia de tus cambios y recarga la página.' };
    }
  } catch { return { values, message: 'No se pudo confirmar la operación. Comprueba tu conexión y reintenta con este mismo formulario.' }; }
  revalidatePath(`/admin/eventos/${eventId}/categorias`);
  revalidatePath(`/admin/eventos/${eventId}/categorias/${categoryId}`);
  redirect(`/admin/eventos/${eventId}/categorias/${categoryId}?resultado=${version === null ? 'creada' : 'guardada'}`);
}
