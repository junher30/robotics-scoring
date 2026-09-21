import Link from 'next/link';
import { EventShell } from '../../shell';
import s from '../../events.module.css';
export default function NotFound() {
  return <EventShell><section className={s.card}><h1>Categoría o evento no disponible</h1><p className={s.muted}>No existe o tu cuenta no tiene acceso.</p><Link href="/admin/eventos" className={s.secondary}>Volver a eventos</Link></section></EventShell>;
}
