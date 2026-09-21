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
