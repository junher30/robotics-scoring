'use client';
import Link from 'next/link';
import { EventShell } from '../../shell';
import s from '../../events.module.css';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <EventShell><section className={s.card}><h1>No pudimos cargar esta sección</h1><p className={s.muted}>Comprueba tu conexión y vuelve a intentarlo.</p><div className={s.actions}><Link href="/admin/eventos" className={s.secondary}>Volver a eventos</Link><button onClick={reset} className={s.primary}>Reintentar</button></div></section></EventShell>;
}
