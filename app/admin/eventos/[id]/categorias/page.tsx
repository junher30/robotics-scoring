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
