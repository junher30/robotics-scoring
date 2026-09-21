import type {Metadata} from 'next';
import {requireAccess} from '../../../lib/auth/authorization';
import {PasswordForm} from './password-form';
import s from '../../admin/eventos/events.module.css';
import styles from '../../admin/usuarios/users.module.css';
export const metadata:Metadata={title:'Crea tu contraseña | RoboScore',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page() {
  const profile=await requireAccess();
  return <div className={s.screen}><main className={s.main}><div className={styles.narrow}><section className={s.card}><header className={s.title}><p>BIENVENIDO A ROBOSCORE</p><h1>Crea tu contraseña.</h1><span>Tu cuenta: {profile.email}</span></header><PasswordForm/></section></div></main></div>;
}
