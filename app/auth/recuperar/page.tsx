import type {Metadata} from 'next';
import Link from 'next/link';
import {RecoverForm} from './recover-form';
import s from '../../admin/eventos/events.module.css';
import styles from '../../admin/usuarios/users.module.css';
export const metadata:Metadata={title:'Restablecer contraseña | RoboScore',robots:{index:false,follow:false},referrer:'no-referrer'};
export default function Page(){
 return <div className={s.screen}><main className={s.main}><div className={styles.narrow}><Link href="/" className={s.brand}><span>R</span>RoboScore.</Link><section className={s.card} style={{marginTop:35}}><header className={s.title}><p>RECUPERA TU ACCESO</p><h1>Restablece tu contraseña.</h1><span>Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva. También sirve si aceptaste una invitación pero no llegaste a crear tu contraseña.</span></header><RecoverForm/><p className={s.muted}>¿Ya la recordaste? <Link href="/login">Inicia sesión</Link>.</p></section></div></main></div>;
}
