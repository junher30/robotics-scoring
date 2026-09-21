import Link from 'next/link';
import styles from './event-navigation.module.css';

export function EventNavigation({ eventId, current }: { eventId: string; current: 'info' | 'categories' }) {
  return <nav className={styles.nav} aria-label="Secciones del evento">
    <Link href={`/admin/eventos/${eventId}`} aria-current={current === 'info' ? 'page' : undefined}>Información</Link>
    <Link href={`/admin/eventos/${eventId}/categorias`} aria-current={current === 'categories' ? 'page' : undefined}>Categorías</Link>
  </nav>;
}
