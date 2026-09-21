import type {Metadata} from 'next';
import Link from 'next/link';
import {readManagedUser} from '../../../../lib/users/access';
import {roleLabels,userValues} from '../../../../lib/users/schema';
import {UserShell} from '../shell';
import {UserForm} from '../user-form';
import {DeleteJudge} from '../delete-judge';
import s from '../../eventos/events.module.css';
import styles from '../users.module.css';
export const metadata:Metadata={title:'Cuenta de usuario | RoboScore',robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{resultado?:string}>}) {
  const {actor,user}=await readManagedUser((await params).id);
  const locked=user.id===actor.id||user.role==='SUPER_ADMIN';
  return <UserShell superAdmin={actor.role==='SUPER_ADMIN'}><div className={styles.narrow}><header className={s.title}><p>{roleLabels[user.role]}</p><h1>{[user.first_name,user.last_name].filter(Boolean).join(' ')||'Cuenta de usuario'}</h1><span>Información y acceso a RoboScore.</span></header>
    {(await searchParams).resultado==='guardado'&&<p role="status" className={s.success}>Cambios guardados.</p>}
    {locked?<section className={s.card}><h2>Cuenta protegida</h2><p className={s.muted}>Este módulo no modifica tu propia cuenta ni las cuentas de superadministrador.</p><dl className={styles.details}><dt>Correo</dt><dd>{user.email}</dd><dt>Rol</dt><dd>{roleLabels[user.role]}</dd><dt>Estado</dt><dd>{user.active?'Activa':'Desactivada'}</dd></dl><Link href="/admin/usuarios" className={s.secondary}>Volver al listado</Link></section>:<UserForm id={user.id} version={user.updated_at} initial={userValues(user)} superAdmin={actor.role==='SUPER_ADMIN'}/>}
    {!locked&&user.role==='JUDGE'&&<DeleteJudge id={user.id} version={user.updated_at} name={[user.first_name,user.last_name].filter(Boolean).join(' ')||user.email||'este juez'}/>}
  </div></UserShell>;
}
