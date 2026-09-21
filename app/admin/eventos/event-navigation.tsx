import Link from 'next/link';
import styles from './event-navigation.module.css';

export function EventNavigation({ eventId, current }: { eventId: string; current: 'info' | 'categories' | 'teams' | 'scores' | 'judges' }) {
  return <nav className={styles.nav} aria-label="Secciones del evento">
    <Link href={`/admin/eventos/${eventId}`} aria-current={current === 'info' ? 'page' : undefined}>Información</Link>
    <Link href={`/admin/eventos/${eventId}/categorias`} aria-current={current === 'categories' ? 'page' : undefined}>Categorías</Link>
    <Link href={`/admin/eventos/${eventId}/equipos`} aria-current={current === 'teams' ? 'page' : undefined}>Equipos</Link>
    <Link href={`/admin/eventos/${eventId}/puntuaciones`} aria-current={current === 'scores' ? 'page' : undefined}>Puntuaciones</Link>
    <Link href={`/admin/eventos/${eventId}/jueces`} aria-current={current === 'judges' ? 'page' : undefined}>Jueces asignados</Link>
  </nav>;
}
