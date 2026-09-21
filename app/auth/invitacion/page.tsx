import type {Metadata} from 'next';
import Link from 'next/link';
import {AcceptForm} from './accept-form';
import s from '../../admin/eventos/events.module.css';
import styles from '../../admin/usuarios/users.module.css';
export const metadata:Metadata={title:'Tu invitación | RoboScore',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page({searchParams}:{searchParams:Promise<{token_hash?:string}>}) {
  const token=(await searchParams).token_hash??'';
  const valid=/^[a-f0-9]{40,128}$/i.test(token);
  return <div className={s.screen}><main className={s.main}><div className={styles.narrow}><Link href="/" className={s.brand}><span>R</span>RoboScore.</Link><section className={s.card} style={{marginTop:35}}><header className={s.title}><p>TU EQUIPO TE ESPERA</p><h1>{valid?'Tienes una invitación.':'Revisa tu enlace.'}</h1><span>{valid?'Acepta para verificar tu correo y elegir una contraseña personal.':'Abre el enlace completo que recibiste en el correo de invitación.'}</span></header>{valid&&<AcceptForm token={token}/>}<p className={s.muted}>¿Ya tienes contraseña? <Link href="/login">Inicia sesión</Link>.</p></section></div></main></div>;
}
