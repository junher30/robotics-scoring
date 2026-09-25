'use client';
import {useActionState} from 'react';
import {requestPasswordReset,type RecoverState} from './actions';
import s from '../../admin/eventos/events.module.css';
export function RecoverForm(){
 const [state,action,pending]=useActionState<RecoverState,FormData>(requestPasswordReset,{});
 return <form action={action} noValidate aria-busy={pending}>
  {state.message&&<p role="status" className={s.success}>{state.message}</p>}
  {state.error&&<p role="alert" className={s.error}>{state.error}</p>}
  <fieldset disabled={pending} className={s.formFields}>
   <div className={s.field}><label htmlFor="email">Correo de tu cuenta</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={state.email??''}/></div>
   <button className={s.primary} disabled={pending}>{pending?'Enviando…':'Enviarme el enlace'}</button>
  </fieldset>
 </form>;
}
