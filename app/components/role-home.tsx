import { Brand } from './brand';
import Link from 'next/link';
import type { UserProfile } from '../../lib/auth/profile';
import { LogoutButton } from '../cuenta/logout-button';
import styles from '../login/login.module.css';
export function RoleHome({ profile, denied }: { profile: UserProfile; denied: boolean }) {
  const judge = profile.role === 'JUDGE';
  const role = { SUPER_ADMIN: 'Superadministrador', ADMIN: 'Administrador', JUDGE: 'Juez' }[profile.role];
  return <main className={styles.accountScreen}><section className={styles.accountCard}>
    <Link href="/" className={styles.brand}><Brand/></Link>
    {denied && <p role="alert" className={styles.error}>Tu cuenta no tiene acceso al área solicitada. Estás en tu espacio autorizado.</p>}
    <p className={styles.success}>Acceso verificado · {role}</p>
    <h1>{judge ? 'Espacio de jueces' : 'Espacio de administración'}</h1>
    <p className={styles.description}>Hola{profile.first_name ? `, ${profile.first_name}` : ''}. {judge ? 'Aquí podrás evaluar los retos que te asignen.' : 'Aquí podrás organizar tus competencias.'}</p>
    <dl className={styles.profile}><div><dt>Correo</dt><dd>{profile.email}</dd></div><div><dt>Rol</dt><dd>{role}</dd></div><div><dt>Estado</dt><dd>Cuenta activa</dd></div></dl>
    <p className={styles.description}>{judge ? 'Las asignaciones y la captura de puntuaciones estarán disponibles en una próxima fase.' : 'La gestión de eventos, equipos y jueces se habilitará en las siguientes fases.'}</p>
    <Link href="/cuenta" className={styles.back}>Ver mi cuenta →</Link>
    <LogoutButton/>
    <Link href="/" className={styles.back}>← Volver al inicio</Link>
  </section></main>;
}
