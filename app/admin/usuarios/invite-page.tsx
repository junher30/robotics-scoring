import {requireUserManager} from '../../../lib/users/access';
import {invitationsReady} from '../../../lib/supabase/admin';
import {blankUser} from '../../../lib/users/schema';
import {UserShell} from './shell';
import {UserForm} from './user-form';
import s from '../eventos/events.module.css';
import styles from './users.module.css';
export async function InvitePage({judgeOnly=false,role='JUDGE'}:{judgeOnly?:boolean;role?:string}) {
  const actor=await requireUserManager(!judgeOnly);
  const ready=invitationsReady();
  return <UserShell superAdmin={actor.role==='SUPER_ADMIN'}><div className={styles.narrow}><header className={s.title}><p>SUMA TALENTO A TU EQUIPO</p><h1>{judgeOnly?'Invitar juez.':'Invitar usuario.'}</h1><span>Un acceso personal para cada integrante de la organización.</span></header>
    {!ready&&<div className={styles.notice} role="status"><strong>Las invitaciones necesitan una configuración inicial.</strong><p>Completa la configuración del servidor y del correo siguiendo la guía de la fase 11. Después podrás enviar invitaciones desde aquí.</p></div>}
    <UserForm superAdmin={actor.role==='SUPER_ADMIN'} judgeOnly={judgeOnly} ready={ready} initial={{...blankUser,role:!judgeOnly&&role==='ADMIN'?'ADMIN':'JUDGE'}}/>
  </div></UserShell>;
}
