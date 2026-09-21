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
