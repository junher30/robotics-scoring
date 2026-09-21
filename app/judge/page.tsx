import type { Metadata } from 'next';
import { requireAccess } from '../../lib/auth/authorization';
import Link from 'next/link';
import {judgeData,type Assignment} from '../../lib/judges/read';
import {JudgeShell} from './shell';
import s from '../admin/eventos/events.module.css';
export const metadata: Metadata = { title: 'Jueces | RoboScore', robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const profile = await requireAccess('judge');
  const params = await searchParams;
  const assignments=await judgeData<Assignment[]>('roboscore_judge_home');
  return <JudgeShell><header className={s.title}><p>ESPACIO DEL JUEZ</p><h1>Hola, {profile.first_name||'juez'}.</h1><span>Elige una categoría, busca el equipo y registra el resultado de cada reto.</span></header>{params.aviso==='permisos'&&<p className={s.error}>Estás en tu espacio de calificación. Tu cuenta no tiene acceso al área administrativa.</p>}
  {!assignments.length?<section className={s.empty}><h2>Aún no tienes categorías asignadas</h2><p>Tu organizador debe asignarte a una categoría del evento para que puedas calificar sus equipos.</p><Link className={s.secondary} href="/judge">Actualizar asignaciones</Link></section>:<div className={s.list}>{assignments.map(a=><article className={s.event} key={a.id}><div><span className={s.badge}>{a.event_status==='ACTIVE'&&a.category_status==='ACTIVE'&&a.rule?'Lista para calificar':'Solo consulta · pendiente de activación'}</span><h2>{a.category_name}</h2><p>{a.event_name} · {a.teams} equipos · {a.challenge_count??'Sin configurar'} retos</p></div><Link className={s.secondary} href={`/judge/categorias/${a.category_id}`}>Ver equipos →</Link></article>)}</div>}</JudgeShell>;
}
