'use client';
import {useActionState,useEffect,useRef} from 'react';
import Link from 'next/link';
import {inviteUser,updateUser} from './actions';
import {blankUser,type UserValues,type UserState} from '../../../lib/users/schema';
import s from '../eventos/events.module.css';
import styles from './users.module.css';
export function UserForm({id,version,initial=blankUser,superAdmin,judgeOnly=false,ready=true}:{id?:string;version?:string;initial?:UserValues;superAdmin:boolean;judgeOnly?:boolean;ready?:boolean}) {
  const editing=Boolean(id&&version);
  const [state,action,pending]=useActionState<UserState,FormData>(id&&version?updateUser.bind(null,id,version):inviteUser,{});
  const notice=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(state.message) notice.current?.focus();},[state]);
  const values=state.values??initial;
  const error=(field:keyof UserValues)=>state.errors?.[field]?.[0];
  const props=(field:keyof UserValues)=>({'aria-invalid':Boolean(error(field)),'aria-describedby':error(field)?`${field}-error`:undefined});
  const fieldError=(field:keyof UserValues)=>error(field)?<p id={`${field}-error`} className={s.fieldError}>{error(field)}</p>:null;
  const back=superAdmin&&!judgeOnly?'/admin/usuarios':'/admin/jueces';
  return <form action={action} noValidate aria-busy={pending}>
    {state.message&&<div ref={notice} tabIndex={-1} role={state.success?'status':'alert'} className={state.success?s.success:s.error}>{state.message}{state.success&&<p><Link href={back}>Volver al listado →</Link></p>}</div>}
    <fieldset className={s.formFields} disabled={pending||!ready||Boolean(state.success)}>
      <section className={s.card}><h2>{editing?'Datos de la cuenta':'Una invitación para formar parte'}</h2><p className={s.muted}>{editing?'Actualiza los datos y el acceso a RoboScore.':'La persona recibirá un correo para aceptar la invitación y crear su contraseña.'} Los campos con * son obligatorios.</p>
        <div className={s.grid}>{(['first_name','last_name'] as const).map(field=><div className={s.field} key={field}><label htmlFor={field}>{field==='first_name'?'Nombre':'Apellido'} *</label><input id={field} name={field} autoComplete={field==='first_name'?'given-name':'family-name'} maxLength={field==='first_name'?100:150} required defaultValue={values[field]} {...props(field)}/>{fieldError(field)}</div>)}</div>
        <div className={s.field}><label htmlFor="email">Correo electrónico{!editing?' *':''}</label><input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required={!editing} readOnly={editing} defaultValue={values.email} {...props('email')}/>{fieldError('email')}{editing&&<p className={styles.fieldNote}>El correo está vinculado a la cuenta de acceso y no se cambia desde esta ficha.</p>}</div>
        <div className={s.field}><label htmlFor="phone">Teléfono (opcional)</label><input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={40} defaultValue={values.phone} {...props('phone')}/>{fieldError('phone')}</div>
        {superAdmin&&!judgeOnly?<div className={s.field}><label htmlFor="role">Rol *</label><select id="role" name="role" defaultValue={values.role} {...props('role')}><option value="JUDGE">Juez</option><option value="ADMIN">Administrador</option></select>{fieldError('role')}<p className={styles.fieldNote}>Un administrador puede crear eventos y gestionar sus jueces. Un juez evaluará las categorías que tenga asignadas.</p></div>:<><input type="hidden" name="role" value="JUDGE"/><p className={s.muted}>Rol: Juez</p></>}
        {editing&&<div className={s.field}><label htmlFor="active">Acceso a RoboScore *</label><select id="active" name="active" defaultValue={values.active} {...props('active')}><option value="true">Activo</option><option value="false">Desactivado</option></select>{fieldError('active')}<p className={styles.fieldNote}>Al desactivar se bloquea el acceso a los datos de RoboScore. La cuenta y su historial se conservan.</p></div>}
      </section>
      <div className={s.actions}><Link className={s.secondary} href={back}>Volver al listado</Link><button className={s.primary} disabled={pending||!ready||Boolean(state.success)}>{pending?(editing?'Guardando…':'Enviando invitación…'):(editing?'Guardar cambios':'Enviar invitación')}</button></div>
    </fieldset>
  </form>;
}
