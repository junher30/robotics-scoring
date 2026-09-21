import { Brand } from '../components/brand';
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAccess, homeForRole } from '../../lib/auth/authorization';
import { LogoutButton } from './logout-button';
import styles from '../login/login.module.css';
export const metadata: Metadata = { title: 'Mi sesión | RoboScore', robots: { index: false, follow: false } };
export default async function AccountPage() {
  const profile = await requireAccess();
  const labels = { SUPER_ADMIN: 'Superadministrador', ADMIN: 'Administrador', JUDGE: 'Juez' };
  return <main className={styles.accountScreen}><section className={styles.accountCard}><Link href="/" className={styles.brand}><Brand/></Link><p className={styles.success} role="status">Sesión iniciada correctamente</p><h1>Hola{profile.first_name ? `, ${profile.first_name}` : ''}.</h1><p className={styles.description}>Tu acceso a RoboScore está listo.</p><dl className={styles.profile}><div><dt>Correo</dt><dd>{profile.email}</dd></div><div><dt>Rol</dt><dd>{labels[profile.role]}</dd></div><div><dt>Cuenta</dt><dd>Activa</dd></div></dl><Link href={homeForRole(profile.role)} className={styles.back}>Ir a mi espacio →</Link><LogoutButton/><Link href="/" className={styles.back}>← Volver a la página principal</Link></section></main>;
}
