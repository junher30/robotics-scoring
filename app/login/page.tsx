import { Brand } from '../components/brand';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { homeForRole } from '../../lib/auth/authorization';
import { readAccess } from '../../lib/auth/profile';
import { LoginForm } from './login-form';
import styles from './login.module.css';
export const metadata: Metadata = { title: 'Iniciar sesión | RoboScore', robots: { index: false, follow: false } };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ salida?: string; aviso?: string }> }) {
  let connectionError = false;
  let destination: string | null = null;
  try { const { profile } = await readAccess(); if (profile) destination = homeForRole(profile.role); } catch { connectionError = true; }
  if (destination) redirect(destination);
  const params = await searchParams;
  return <main className={styles.screen}><div className={styles.shell}>
    <aside className={styles.story}><Link href="/" className={styles.brand}><Brand/></Link><div><p className={styles.eyebrow}>EL TALENTO NECESITA UN BUEN EQUIPO</p><h1>Detrás de cada<br/>gran reto,<br/><em>estás tú.</em></h1><p className={styles.storyText}>Tu espacio para acompañar a quienes construyen el futuro.</p></div><div className={styles.storyFooter}><span>01 / ACCESO</span><span>Crear. Aprender. Competir.</span></div></aside>
    <section className={styles.content} aria-labelledby="login-title"><Link href="/" className={styles.back}>← Volver a RoboScore</Link><div className={styles.card}><span className={styles.kicker}>BIENVENIDO A ROBOSCORE</span><h2 id="login-title">Qué bueno verte.</h2><p className={styles.description}>Ingresa con la cuenta que te asignó tu organizador.</p>
      {params.salida === '1' && <p role="status" className={styles.success}>Cerraste sesión en este dispositivo.</p>}
      {params.aviso === 'acceso' && <p role="alert" className={styles.error}>Inicia sesión con una cuenta activa para continuar.</p>}
      {connectionError && <p role="alert" className={styles.error}>No pudimos conectar con el servicio. Inténtalo de nuevo en unos momentos.</p>}
      <LoginForm/>
      <details className={styles.help}><summary>¿Olvidaste tu contraseña o no tienes cuenta?</summary><p><Link href="/auth/recuperar">Restablecer mi contraseña</Link> con el correo de tu cuenta. Si no tienes cuenta, contacta al administrador de tu evento: el registro público está cerrado.</p></details>
    </div><p className={styles.footer}>RoboScore · Un lugar para construir el futuro.</p></section>
  </div></main>;
}
