# Fase 10 — Código completo

Archivos de la gestión de categorías por evento. Ya están implementados en el proyecto activo. Para instalar únicamente los permisos remotos, sigue `FASE-10-CATEGORIAS.md`; no ejecutes las fixtures de pruebas en Supabase.

Este código usa la autenticación, los estilos compartidos y las tablas de las fases anteriores.

## app/admin/eventos/event-navigation.tsx

```tsx
import Link from 'next/link';
import styles from './event-navigation.module.css';

export function EventNavigation({ eventId, current }: { eventId: string; current: 'info' | 'categories' }) {
  return <nav className={styles.nav} aria-label="Secciones del evento">
    <Link href={`/admin/eventos/${eventId}`} aria-current={current === 'info' ? 'page' : undefined}>Información</Link>
    <Link href={`/admin/eventos/${eventId}/categorias`} aria-current={current === 'categories' ? 'page' : undefined}>Categorías</Link>
  </nav>;
}
```

## app/admin/eventos/event-navigation.module.css

```css
.nav{display:flex;gap:24px;flex-wrap:wrap;border-bottom:1px solid #e0e5ed;margin:0 0 28px;padding:0 2px}.nav a{color:#637087;text-decoration:none;font-size:14px;padding:13px 3px;border-bottom:3px solid transparent}.nav a[aria-current=page]{border-color:#d92e3a;color:#bd2c37;font-weight:700}.nav a:hover{color:#bd2c37}.nav a:focus-visible{outline:3px solid #bd2c37;outline-offset:3px}
```

## app/admin/eventos/[id]/page.tsx

```tsx
import type {Metadata} from 'next';
import {z} from 'zod';
import {notFound} from 'next/navigation';
import Link from 'next/link';
import {requireAccess} from '../../../../lib/auth/authorization';
import {readEvent} from '../../../../lib/events/read';
import {recordValues} from '../../../../lib/events/schema';
import {EventShell} from '../shell';
import {EventForm} from '../event-form';
import {EventNavigation} from '../event-navigation';
import s from '../events.module.css';
export const metadata:Metadata={title:'Editar evento | RoboScore',robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{resultado?:string}>}){
 await requireAccess('admin');const {id}=await params;if(!z.string().uuid().safeParse(id).success)notFound();
 const {data,error}=await readEvent(id);const query=await searchParams;
 if(error)return <EventShell><div role="alert" className={s.error}>No pudimos cargar el evento. Comprueba la conexión y que el SQL de la fase 9 esté instalado.</div><Link href={`/admin/eventos/${id}`} className={s.secondary}>Reintentar</Link></EventShell>;
 if(!data)notFound();
 return <EventShell><header className={s.title}><p>DETALLES DE TU COMPETENCIA</p><h1>{data.name}</h1><span>Edita la información o cambia el estado. Los cambios se aplican al guardar.</span></header><EventNavigation eventId={id} current="info"/>{['creado','guardado'].includes(query.resultado??'')&&<p role="status" className={s.success}>{query.resultado==='creado'?'Evento creado correctamente.':'Cambios guardados.'}</p>}<EventForm key={data.updated_at} id={id} version={data.updated_at} initial={recordValues(data)}/></EventShell>;
}
```

## app/admin/eventos/[id]/categorias/[categoryId]/page.tsx

```tsx
import type { Metadata } from 'next';
import { categoryEvent, readCategory } from '../../../../../../lib/categories/read';
import { categoryValues } from '../../../../../../lib/categories/schema';
import { EventShell } from '../../../shell';
import { EventNavigation } from '../../../event-navigation';
import { CategoryForm } from '../category-form';
import s from '../../../events.module.css';
export const metadata: Metadata = { title: 'Editar categoría | RoboScore', robots: { index: false, follow: false } };
export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string; categoryId: string }>; searchParams: Promise<{ resultado?: string }>;
}) {
  const { id, categoryId } = await params;
  const event = await categoryEvent(id);
  const category = await readCategory(id, categoryId);
  const { resultado } = await searchParams;
  return <EventShell><header className={s.title}><p>{event.name}</p><h1>{category.name}</h1><span>Actualiza los detalles, el orden o el estado de esta categoría.</span></header><EventNavigation eventId={id} current="categories"/>
    {['creada', 'guardada'].includes(resultado ?? '') && <p role="status" className={s.success}>{resultado === 'creada' ? 'Categoría creada correctamente.' : 'Cambios guardados.'}</p>}
    <CategoryForm key={category.updated_at} eventId={id} categoryId={categoryId} version={category.updated_at} initial={categoryValues(category)}/>
  </EventShell>;
}
```

## app/admin/eventos/[id]/categorias/actions.ts

```ts
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
```

## app/admin/eventos/[id]/categorias/categories.module.css

```css
.heading{display:flex;align-items:center;justify-content:space-between;gap:18px;margin:0 0 22px}.heading h2{font-size:26px;font-weight:700;letter-spacing:-.6px;margin:0}.description{white-space:pre-line;overflow-wrap:anywhere;max-width:640px}.meta{margin-top:12px!important}@media(max-width:650px){.heading{align-items:flex-start;flex-direction:column}.heading>a{width:100%}}
```

## app/admin/eventos/[id]/categorias/category-form.tsx

```tsx
'use client';
import { useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { saveCategory } from './actions';
import { categoryStatuses, categoryStatusLabels, emptyCategory, type CategoryState, type CategoryValues } from '../../../../../lib/categories/schema';
import s from '../../events.module.css';

export function CategoryForm({ eventId, categoryId, version = null, initial = emptyCategory }: {
  eventId: string; categoryId: string; version?: string | null; initial?: CategoryValues;
}) {
  const [state, action, pending] = useActionState<CategoryState, FormData>(saveCategory.bind(null, eventId, categoryId, version), {});
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state.message) notice.current?.focus(); }, [state]);
  const values = state.values ?? initial;
  const error = (key: keyof CategoryValues) => state.errors?.[key]?.[0];
  const errorProps = (key: keyof CategoryValues) => ({ 'aria-invalid': Boolean(error(key)), 'aria-describedby': error(key) ? `${key}-error` : undefined });
  function fieldError(key: keyof CategoryValues) { return error(key) ? <p id={`${key}-error`} className={s.fieldError}>{error(key)}</p> : null; }
  return <form action={action} noValidate aria-busy={pending}>
    {state.message && <div ref={notice} tabIndex={-1} role="alert" className={s.error}>{state.message}</div>}
    <fieldset className={s.formFields} disabled={pending}>
      <section className={s.card}>
        <h2>Una categoría para cada reto</h2>
        <p className={s.muted}>Por ejemplo: Mini Sumo, Seguidor de Línea o Innovación. Los campos con * son obligatorios.</p>
        <div className={s.field}><label htmlFor="name">Nombre de la categoría *</label><input id="name" name="name" required maxLength={100} defaultValue={values.name} {...errorProps('name')}/>{fieldError('name')}</div>
        <div className={s.field}><label htmlFor="description">Descripción</label><textarea id="description" name="description" rows={4} maxLength={3000} defaultValue={values.description} {...errorProps('description')}/>{fieldError('description')}</div>
        <div className={s.grid}>
          <div className={s.field}><label htmlFor="max_teams">Máximo de equipos (opcional)</label><input id="max_teams" name="max_teams" type="number" min={1} max={2147483647} step={1} defaultValue={values.max_teams} {...errorProps('max_teams')}/>{fieldError('max_teams')}<p className={s.muted}>Déjalo vacío si aún no has definido una capacidad.</p></div>
          <div className={s.field}><label htmlFor="sort_order">Orden de presentación *</label><input id="sort_order" name="sort_order" type="number" required min={0} max={2147483647} step={1} defaultValue={values.sort_order} {...errorProps('sort_order')}/>{fieldError('sort_order')}<p className={s.muted}>Los números menores aparecen primero. Si coinciden, se ordenan por nombre.</p></div>
        </div>
        <div className={s.field}><label htmlFor="status">Estado *</label><select id="status" name="status" defaultValue={values.status} {...errorProps('status')}>{categoryStatuses.map(status => <option key={status} value={status}>{categoryStatusLabels[status]}</option>)}</select>{fieldError('status')}<p className={s.muted}>Borrador para preparar, Activa para usar y Cerrada para conservar su información. Puedes cambiarlo más adelante.</p></div>
      </section>
      <div className={s.actions}><Link href={`/admin/eventos/${eventId}/categorias`} className={s.secondary}>Volver a categorías</Link><button className={s.primary} type="submit" disabled={pending}>{pending ? 'Guardando…' : version ? 'Guardar cambios' : 'Crear categoría'}</button></div>
    </fieldset>
  </form>;
}
```

## app/admin/eventos/[id]/categorias/error.tsx

```tsx
'use client';
import Link from 'next/link';
import { EventShell } from '../../shell';
import s from '../../events.module.css';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <EventShell><section className={s.card}><h1>No pudimos cargar esta sección</h1><p className={s.muted}>Comprueba tu conexión y vuelve a intentarlo.</p><div className={s.actions}><Link href="/admin/eventos" className={s.secondary}>Volver a eventos</Link><button onClick={reset} className={s.primary}>Reintentar</button></div></section></EventShell>;
}
```

## app/admin/eventos/[id]/categorias/not-found.tsx

```tsx
import Link from 'next/link';
import { EventShell } from '../../shell';
import s from '../../events.module.css';
export default function NotFound() {
  return <EventShell><section className={s.card}><h1>Categoría o evento no disponible</h1><p className={s.muted}>No existe o tu cuenta no tiene acceso.</p><Link href="/admin/eventos" className={s.secondary}>Volver a eventos</Link></section></EventShell>;
}
```

## app/admin/eventos/[id]/categorias/nueva/page.tsx

```tsx
import type { Metadata } from 'next';
import { randomUUID } from 'node:crypto';
import { categoryEvent } from '../../../../../../lib/categories/read';
import { EventShell } from '../../../shell';
import { EventNavigation } from '../../../event-navigation';
import { CategoryForm } from '../category-form';
import s from '../../../events.module.css';
export const metadata: Metadata = { title: 'Nueva categoría | RoboScore', robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await categoryEvent(id);
  return <EventShell><header className={s.title}><p>{event.name}</p><h1>Nueva categoría.</h1><span>Organiza los tipos de pruebas de tu competencia.</span></header><EventNavigation eventId={id} current="categories"/><CategoryForm eventId={id} categoryId={randomUUID()}/></EventShell>;
}
```

## app/admin/eventos/[id]/categorias/page.tsx

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { categoryEvent, categoryColumns } from '../../../../../lib/categories/read';
import { categoryStatuses, categoryStatusLabels, type CategoryRecord } from '../../../../../lib/categories/schema';
import { createClient } from '../../../../../lib/supabase/server';
import { EventShell } from '../../shell';
import { EventNavigation } from '../../event-navigation';
import s from '../../events.module.css';
import styles from './categories.module.css';

export const metadata: Metadata = { title: 'Categorías | RoboScore', robots: { index: false, follow: false } };
export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ estado?: string; pagina?: string }>;
}) {
  const { id } = await params;
  const event = await categoryEvent(id);
  const query = await searchParams;
  const status = categoryStatuses.find(value => value === query.estado);
  const page = /^[1-9]\d{0,5}$/.test(query.pagina ?? '') ? Number(query.pagina) : 1;
  let rows: CategoryRecord[] = [], count = 0, failed = false;
  try {
    const client = await createClient();
    let request = client.from('event_categories').select(categoryColumns, { count: 'exact' }).eq('event_id', id)
      .order('sort_order').order('name').order('id').range((page - 1) * 20, page * 20 - 1);
    if (status) request = request.eq('status', status);
    const result = await request.returns<CategoryRecord[]>();
    rows = result.data ?? []; count = result.count ?? 0; failed = Boolean(result.error);
  } catch { failed = true; }
  const base = `/admin/eventos/${id}/categorias`;
  const pageUrl = (value: number) => `${base}?${new URLSearchParams({ ...(status ? { estado: status } : {}), pagina: String(value) })}`;
  return <EventShell>
    <header className={s.title}><p>ORGANIZA LA COMPETENCIA</p><h1>{event.name}</h1><span>Cada categoría reúne equipos que compiten en el mismo tipo de prueba.</span></header>
    <EventNavigation eventId={id} current="categories"/>
    <div className={styles.heading}><h2>Categorías</h2><Link href={`${base}/nueva`} className={s.primary}>+ Nueva categoría</Link></div>
    <form method="get" className={s.filters}><label htmlFor="estado">Estado</label><select id="estado" name="estado" defaultValue={status ?? ''}><option value="">Todas</option>{categoryStatuses.map(value => <option value={value} key={value}>{categoryStatusLabels[value]}</option>)}</select><button className={s.secondary}>Filtrar</button><Link href={base} className={s.textLink}>Limpiar</Link></form>
    {failed ? <div role="alert" className={s.error}>No pudimos cargar las categorías. Comprueba la conexión y la configuración de categorías. <Link href={pageUrl(page)}>Reintentar</Link></div> : <>
      <p className={s.muted}>{count} {count === 1 ? 'categoría' : 'categorías'} · Página {page}</p>
      {rows.length === 0 ? <section className={s.empty}><span aria-hidden="true">◈</span><h2>{status || page > 1 ? 'No hay categorías en esta vista' : 'Dale forma a tu competencia'}</h2><p>{status || page > 1 ? 'Prueba otro estado o vuelve a la primera página.' : 'Crea tu primera categoría. Más adelante podrás añadir sus equipos y puntuaciones.'}</p><Link className={s.primary} href={status || page > 1 ? base : `${base}/nueva`}>{status || page > 1 ? 'Ver todas' : 'Crear mi primera categoría'}</Link></section> :
        <div className={s.list}>{rows.map(category => <article key={category.id} className={s.event}><div><span className={s.badge}>{categoryStatusLabels[category.status]}</span><h2><Link href={`${base}/${category.id}`}>{category.name}</Link></h2>{category.description && <p className={styles.description}>{category.description}</p>}<p className={styles.meta}>Orden {category.sort_order} · {category.max_teams === null ? 'Capacidad sin definir' : `Hasta ${category.max_teams} equipos`}</p></div><Link href={`${base}/${category.id}`} className={s.secondary}>Editar categoría →</Link></article>)}</div>}
      <nav className={s.pagination} aria-label="Páginas de categorías">{page > 1 && <Link href={pageUrl(page - 1)} className={s.secondary}>← Anterior</Link>}{page * 20 < count && <Link href={pageUrl(page + 1)} className={s.secondary}>Siguiente →</Link>}</nav>
    </>}
  </EventShell>;
}
```

## lib/categories/read.ts

```ts
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
```

## lib/categories/schema.ts

```ts
import { z } from 'zod';

export const categoryStatuses = ['DRAFT', 'ACTIVE', 'CLOSED'] as const;
export const categoryStatusLabels = { DRAFT: 'Borrador', ACTIVE: 'Activa', CLOSED: 'Cerrada' };
const positiveInteger = (value: string) => /^[1-9]\d*$/.test(value) && Number(value) <= 2147483647;

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre de la categoría.').max(100, 'Usa como máximo 100 caracteres.'),
  description: z.string().trim().max(3000, 'Usa como máximo 3000 caracteres.'),
  max_teams: z.string().trim().refine(value => value === '' || positiveInteger(value), 'Escribe un número entero positivo o deja el campo vacío.'),
  sort_order: z.string().trim().refine(value => value === '0' || positiveInteger(value), 'Escribe un entero entre 0 y 2147483647.'),
  status: z.enum(categoryStatuses),
});
export type CategoryValues = z.infer<typeof categorySchema>;
export type CategoryState = {
  message?: string;
  errors?: Partial<Record<keyof CategoryValues, string[]>>;
  values?: CategoryValues;
};
export type CategoryRecord = Omit<CategoryValues, 'description' | 'max_teams' | 'sort_order'> & {
  id: string;
  event_id: string;
  description: string | null;
  max_teams: number | null;
  sort_order: number;
  updated_at: string;
};
export const emptyCategory: CategoryValues = { name: '', description: '', max_teams: '', sort_order: '0', status: 'DRAFT' };
export function categoryPayload(values: CategoryValues) {
  return { ...values, max_teams: values.max_teams ? Number(values.max_teams) : null, sort_order: Number(values.sort_order) };
}
export function categoryValues(record: CategoryRecord): CategoryValues {
  return { name: record.name, description: record.description ?? '', max_teams: record.max_teams?.toString() ?? '', sort_order: String(record.sort_order), status: record.status };
}
```

## supabase/migrations/202609200003_category_management.sql

```sql
-- FASE 10. Repetible. Requiere las fases 3, 4 y 9.
-- No borra categorías ni habilita las tablas de puntuaciones/equipos.
BEGIN;
ALTER TABLE public.event_categories ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.event_categories TO authenticated;
GRANT INSERT (id,event_id,name,description,max_teams,status,sort_order)
  ON public.event_categories TO authenticated;
GRANT UPDATE (name,description,max_teams,status,sort_order)
  ON public.event_categories TO authenticated;

DROP POLICY IF EXISTS categories_admin_read ON public.event_categories;
CREATE POLICY categories_admin_read ON public.event_categories FOR SELECT TO authenticated
USING (
  (SELECT roboscore_private.is_event_admin()) AND EXISTS (
    SELECT 1 FROM public.events e WHERE e.id=event_categories.event_id
      AND (e.created_by=(SELECT auth.uid()) OR (SELECT roboscore_private.is_super_admin()))
  )
);
DROP POLICY IF EXISTS categories_admin_create ON public.event_categories;
CREATE POLICY categories_admin_create ON public.event_categories FOR INSERT TO authenticated
WITH CHECK (
  (SELECT roboscore_private.is_event_admin()) AND EXISTS (
    SELECT 1 FROM public.events e WHERE e.id=event_categories.event_id
      AND (e.created_by=(SELECT auth.uid()) OR (SELECT roboscore_private.is_super_admin()))
  )
);
DROP POLICY IF EXISTS categories_admin_update ON public.event_categories;
CREATE POLICY categories_admin_update ON public.event_categories FOR UPDATE TO authenticated
USING (
  (SELECT roboscore_private.is_event_admin()) AND EXISTS (
    SELECT 1 FROM public.events e WHERE e.id=event_categories.event_id
      AND (e.created_by=(SELECT auth.uid()) OR (SELECT roboscore_private.is_super_admin()))
  )
)
WITH CHECK (
  (SELECT roboscore_private.is_event_admin()) AND EXISTS (
    SELECT 1 FROM public.events e WHERE e.id=event_categories.event_id
      AND (e.created_by=(SELECT auth.uid()) OR (SELECT roboscore_private.is_super_admin()))
  )
);
-- No DELETE ni UPDATE para id/event_id/created_at/updated_at.
-- Los índices y restricciones de la fase 3 evitan nombres duplicados por evento.
NOTIFY pgrst, 'reload schema';
COMMIT;
```

## supabase/verify-phase-10.sql

```sql
SELECT '01. Categorías con RLS' AS check_name, relrowsecurity AS passed
FROM pg_class WHERE oid='public.event_categories'::regclass
UNION ALL
SELECT '02. Tres políticas administrativas', count(*)=3 FROM pg_policies
WHERE schemaname='public' AND tablename='event_categories'
  AND policyname IN ('categories_admin_read','categories_admin_create','categories_admin_update')
UNION ALL
SELECT '03. Lectura authenticated sujeta a RLS', has_table_privilege('authenticated','public.event_categories','SELECT')
UNION ALL
SELECT '04. Escritura de campos autorizados', has_column_privilege('authenticated','public.event_categories','name','INSERT') AND has_column_privilege('authenticated','public.event_categories','sort_order','UPDATE')
UNION ALL
SELECT '05. Categoría y evento inmutables', NOT has_column_privilege('authenticated','public.event_categories','id','UPDATE') AND NOT has_column_privilege('authenticated','public.event_categories','event_id','UPDATE')
UNION ALL
SELECT '06. Sin borrado permanente', NOT has_table_privilege('authenticated','public.event_categories','DELETE')
UNION ALL
SELECT '07. Visitantes sin lectura ni escritura', NOT has_table_privilege('anon','public.event_categories','SELECT') AND NOT has_any_column_privilege('anon','public.event_categories','INSERT') AND NOT has_any_column_privilege('anon','public.event_categories','UPDATE')
UNION ALL
SELECT '08. Nombres únicos por evento', EXISTS (SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('public.categories_event_name_unique') AND indisunique AND indisvalid)
ORDER BY check_name;
```

## tests/category-actions.test.cjs

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function load(file, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => name in dependencies ? dependencies[name] : require(name), Date });
  return module.exports;
}
const schema = load('lib/categories/schema.ts');
const eventId = '00000000-0000-4000-8000-000000000001';
const foreignEvent = '00000000-0000-4000-8000-000000000002';
const categoryId = '00000000-0000-4000-8000-000000000010';
const valid = { ...schema.emptyCategory, name: 'Mini Sumo' };
function form(change = {}) {
  const result = new FormData();
  Object.entries({ ...valid, ...change }).forEach(([key, value]) => result.set(key, value));
  return result;
}
function fixture() {
  const rows = new Map();
  const state = { denied: false, parentVisible: true, offline: false, writes: 0 };
  const action = load('app/admin/eventos/[id]/categorias/actions.ts', {
    '../../../../../lib/categories/schema': schema,
    '../../../../../lib/auth/authorization': { requireAccess: async area => { assert.equal(area, 'admin'); if (state.denied) throw Error('DENIED'); } },
    'next/navigation': { redirect: url => { throw Error('REDIRECT ' + url); } },
    'next/cache': { revalidatePath: () => {} },
    '../../../../../lib/supabase/server': { createClient: async () => ({ from(table) {
      if (state.offline) throw Error('offline');
      const filters = []; let payload;
      const duplicate = (candidate, id) => [...rows.values()].some(row => row.id !== id && row.event_id === candidate.event_id && row.name.trim().toLowerCase() === candidate.name.trim().toLowerCase());
      const query = {
        select: () => query,
        eq: (key, value) => { filters.push([key, value]); return query; },
        update: data => { payload = data; return query; },
        async insert(data) {
          state.writes++;
          if (rows.has(data.id) || duplicate(data)) return { error: { code: '23505' } };
          rows.set(data.id, { ...data, updated_at: '2026-09-20T12:00:00.000Z' });
          return { error: null };
        },
        async maybeSingle() {
          if (table === 'events') return { data: state.parentVisible && filters.every(([key, value]) => key === 'id' && value === eventId) ? { id: eventId } : null, error: null };
          const row = [...rows.values()].find(item => filters.every(([key, value]) => item[key] === value));
          if (row && payload) {
            if (duplicate({ ...row, ...payload }, row.id)) return { data: null, error: { code: '23505' } };
            state.writes++; Object.assign(row, payload, { updated_at: '2026-09-20T12:01:00.000Z' });
          }
          return { data: row ?? null, error: null };
        },
      };
      return query;
    } }) },
  });
  return { rows, state, save: action.saveCategory };
}
for (const [label, data] of [
  ['empty name', { name: '   ' }], ['long name', { name: 'a'.repeat(101) }], ['long description', { description: 'a'.repeat(3001) }],
  ['zero capacity', { max_teams: '0' }], ['fractional capacity', { max_teams: '1.5' }], ['negative order', { sort_order: '-1' }],
  ['missing order', { sort_order: '' }], ['overflow order', { sort_order: '2147483648' }], ['unknown status', { status: 'REGISTRATION' }],
]) test('Rejects ' + label, () => assert.equal(schema.categorySchema.safeParse({ ...valid, ...data }).success, false));
test('Trims name and allows unset capacity with zero order', () => {
  const payload = schema.categoryPayload(schema.categorySchema.parse({ ...valid, name: ' Mini Sumo ' }));
  assert.equal(payload.name, 'Mini Sumo'); assert.equal(payload.max_teams, null); assert.equal(payload.sort_order, 0);
});
test('Requires authorization before every write', async () => {
  const f = fixture(); f.state.denied = true;
  await assert.rejects(f.save(eventId, categoryId, null, {}, form()), { message: 'DENIED' }); assert.equal(f.state.writes, 0);
});
test('Inaccessible parent prevents creation', async () => {
  const f = fixture(); f.state.parentVisible = false;
  const result = await f.save(eventId, categoryId, null, {}, form()); assert.match(result.message, /acceso/); assert.equal(f.state.writes, 0);
});
test('Bound event id is authoritative and retries do not duplicate', async () => {
  const f = fixture(); const body = form(); body.set('event_id', foreignEvent);
  for (let i = 0; i < 2; i++) await assert.rejects(f.save(eventId, categoryId, null, {}, body), { message: `REDIRECT /admin/eventos/${eventId}/categorias/${categoryId}?resultado=creada` });
  assert.equal(f.rows.size, 1); assert.equal(f.rows.get(categoryId).event_id, eventId);
});
test('Duplicate name shows field error and retains values', async () => {
  const f = fixture(); f.rows.set('existing', { ...valid, id: 'existing', event_id: eventId });
  const result = await f.save(eventId, categoryId, null, {}, form({ name: ' MINI SUMO ' }));
  assert(result.errors.name); assert.equal(result.values.name, ' MINI SUMO '); assert.equal(f.rows.size, 1);
});
test('Cannot update category through the wrong parent route', async () => {
  const f = fixture(); f.rows.set(categoryId, { ...valid, id: categoryId, event_id: foreignEvent, updated_at: '2026-09-20T12:00:00.000Z' });
  const result = await f.save(eventId, categoryId, '2026-09-20T12:00:00.000Z', {}, form({ name: 'Changed' }));
  assert.match(result.message, /acceso/); assert.equal(f.rows.get(categoryId).name, valid.name); assert.equal(f.state.writes, 0);
});
test('Stale edit preserves newer data', async () => {
  const f = fixture(); f.rows.set(categoryId, { ...valid, id: categoryId, event_id: eventId, updated_at: '2026-09-20T12:01:00.000Z' });
  const result = await f.save(eventId, categoryId, '2026-09-20T12:00:00.000Z', {}, form({ name: 'Old change' }));
  assert.match(result.message, /otra sesión/); assert.equal(f.rows.get(categoryId).name, valid.name);
});
test('Closing and changing order preserves category', async () => {
  const f = fixture(); f.rows.set(categoryId, { ...valid, id: categoryId, event_id: eventId, updated_at: '2026-09-20T12:00:00.000Z' });
  await assert.rejects(f.save(eventId, categoryId, '2026-09-20T12:00:00.000Z', {}, form({ status: 'CLOSED', sort_order: '12' })), { message: `REDIRECT /admin/eventos/${eventId}/categorias/${categoryId}?resultado=guardada` });
  assert.equal(f.rows.get(categoryId).status, 'CLOSED'); assert.equal(f.rows.get(categoryId).sort_order, 12); assert.equal(f.rows.size, 1);
});
test('Offline failure keeps the entered values', async () => {
  const f = fixture(); f.state.offline = true;
  const result = await f.save(eventId, categoryId, null, {}, form()); assert.match(result.message, /conexión/); assert.equal(result.values.name, valid.name);
});
```

## tests/category-permissions.mjs

```javascript
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const db = new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
  CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO authenticated; GRANT USAGE ON SCHEMA public TO anon;`);
for (const file of ['tests/fixtures/foundation.sql', 'supabase/migrations/202609160001_profiles_roles.sql', 'supabase/migrations/202609200002_event_management.sql']) {
  await db.exec(await fs.readFile(root + file, 'utf8'));
}
const migration = await fs.readFile(root + 'supabase/migrations/202609200003_category_management.sql', 'utf8');
await db.exec(migration);
await db.exec(migration);
const users = Array.from({ length: 5 }, (_, i) => `00000000-0000-4000-8000-00000000000${i + 1}`);
for (let i = 0; i < users.length; i++) {
  await db.query('INSERT INTO auth.users VALUES($1,$2,$3)', [users[i], `fixture${i}@example.test`, {}]);
  await db.query('UPDATE profiles SET role=$1,active=$2 WHERE id=$3', [i === 0 ? 'SUPER_ADMIN' : i === 3 ? 'JUDGE' : 'ADMIN', i !== 4, users[i]]);
}
async function asUser(id, role = 'authenticated') {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('SET ROLE ' + role);
}
let checks = 0;
const pass = label => { checks++; console.log('PASS ' + label); };
const eventIds = [];
for (let i = 1; i <= 2; i++) {
  await asUser(users[i]);
  eventIds.push((await db.query("INSERT INTO events(name,slug,start_date,end_date,created_by) VALUES('Evento',$1,now(),now()+interval '1 day',$2) RETURNING id", ['evento-' + i, users[i]])).rows[0].id);
}
async function create(eventId, name) {
  return (await db.query('INSERT INTO event_categories(event_id,name) VALUES($1,$2) RETURNING id', [eventId, name])).rows[0].id;
}
await asUser(users[1]);
const categoryA = await create(eventIds[0], 'Mini Sumo');
await asUser(users[2]);
const categoryB = await create(eventIds[1], 'Mini Sumo');
pass('Same category name allowed in different events');
await asUser(users[1]);
assert.equal((await db.query('SELECT id FROM event_categories')).rows.length, 1);
assert.equal((await db.query('SELECT id FROM event_categories WHERE id=$1', [categoryB])).rows.length, 0);
pass('Administrator sees only own event categories');
await assert.rejects(create(eventIds[1], 'Foreign'), { code: '42501' });
assert.equal((await db.query("UPDATE event_categories SET name='Foreign' WHERE id=$1 RETURNING id", [categoryB])).rows.length, 0);
pass('Foreign insertion and update denied');
await assert.rejects(create(eventIds[0], ' mini sumo '), { code: '23505' });
pass('Names unique after trimming and case folding');
const second = await create(eventIds[0], 'Innovación');
await assert.rejects(db.query("UPDATE event_categories SET name='MINI SUMO' WHERE id=$1", [second]), { code: '23505' });
pass('Rename cannot duplicate an existing name');
await assert.rejects(db.query('UPDATE event_categories SET event_id=$1 WHERE id=$2', [eventIds[1], categoryA]), { code: '42501' });
await assert.rejects(db.query('UPDATE event_categories SET id=gen_random_uuid() WHERE id=$1', [categoryA]), { code: '42501' });
await assert.rejects(db.query('UPDATE event_categories SET updated_at=now() WHERE id=$1', [categoryA]), { code: '42501' });
pass('Cannot change parent, identity or timestamp');
await assert.rejects(db.query('DELETE FROM event_categories WHERE id=$1', [categoryA]), { code: '42501' });
pass('Permanent deletion denied');
await assert.rejects(db.query('UPDATE event_categories SET max_teams=0 WHERE id=$1', [categoryA]), { code: '23514' });
await assert.rejects(db.query('UPDATE event_categories SET sort_order=-1 WHERE id=$1', [categoryA]), { code: '23514' });
pass('Database enforces positive capacity and nonnegative order');
const before = (await db.query('SELECT updated_at::text AS version FROM event_categories WHERE id=$1', [categoryA])).rows[0].version;
await db.query("UPDATE event_categories SET status='CLOSED',sort_order=10 WHERE id=$1", [categoryA]);
assert.equal((await db.query("UPDATE event_categories SET name='Stale' WHERE id=$1 AND updated_at=$2 RETURNING id", [categoryA, before])).rows.length, 0);
pass('Stale edit cannot overwrite a newer version');
assert.equal((await db.query('SELECT status FROM event_categories WHERE id=$1', [categoryA])).rows[0].status, 'CLOSED');
await db.query("UPDATE event_categories SET status='ACTIVE' WHERE id=$1", [categoryA]);
const sorted = (await db.query('SELECT id FROM event_categories ORDER BY sort_order,name,id')).rows;
assert.equal(sorted[0].id, second); assert.equal(sorted[1].id, categoryA);
pass('Close/reopen preserves category and order is respected');
for (const index of [3, 4]) {
  await asUser(users[index]);
  assert.equal((await db.query('SELECT id FROM event_categories')).rows.length, 0);
  await assert.rejects(create(eventIds[0], 'Denied'), { code: '42501' });
  assert.equal((await db.query("UPDATE event_categories SET name='Denied' RETURNING id")).rows.length, 0);
  pass('Judge or inactive administrator cannot read/write: ' + index);
}
await asUser('', 'anon');
await assert.rejects(db.query('SELECT * FROM event_categories'), { code: '42501' });
pass('Anonymous read denied');
await asUser(users[0]);
assert.equal((await db.query('SELECT id FROM event_categories')).rows.length, 3);
assert.equal((await db.query("UPDATE event_categories SET description='Updated by superadmin' WHERE id=$1 RETURNING id", [categoryB])).rows.length, 1);
await create(eventIds[1], 'Superadmin category');
pass('Superadmin can read/create/edit across events');
await db.exec('RESET ROLE');
await db.query('UPDATE profiles SET active=false WHERE id=$1', [users[1]]);
await asUser(users[1]);
assert.equal((await db.query('SELECT id FROM event_categories')).rows.length, 0);
await assert.rejects(create(eventIds[0], 'Disabled'), { code: '42501' });
pass('Deactivation removes access immediately');
await db.exec('RESET ROLE');
const result = await db.query(await fs.readFile(root + 'supabase/verify-phase-10.sql', 'utf8'));
assert.equal(result.rows.length, 8);
assert(result.rows.every(row => row.passed));
pass('Eight verification checks pass; migration is repeatable');
await db.close();
console.log(`${checks} PostgreSQL checks passed. No Supabase connection used.`);
```
