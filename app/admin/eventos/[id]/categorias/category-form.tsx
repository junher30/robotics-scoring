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
