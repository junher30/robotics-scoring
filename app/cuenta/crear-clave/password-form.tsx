'use client';
import {useActionState,useEffect,useRef} from 'react';
import {savePassword} from './actions';
import type {PasswordState} from '../../../lib/users/password';
import s from '../../admin/eventos/events.module.css';
export function PasswordForm() {
  const [state,action,pending]=useActionState<PasswordState,FormData>(savePassword,{});
  const notice=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(state.message)notice.current?.focus();},[state]);
  return <form action={action} noValidate aria-busy={pending}>
    {state.message&&<div ref={notice} tabIndex={-1} role="alert" className={s.error}>{state.message}</div>}
    <fieldset disabled={pending} className={s.formFields}>
      {(['password','confirmation'] as const).map(field=><div className={s.field} key={field}><label htmlFor={field}>{field==='password'?'Tu nueva contraseña':'Repite la contraseña'}</label><input type="password" id={field} name={field} autoComplete="new-password" required minLength={12} maxLength={128} aria-invalid={Boolean(state.errors?.[field])} aria-describedby={state.errors?.[field]?`${field}-error`:undefined}/>{state.errors?.[field]&&<p id={`${field}-error`} className={s.fieldError}>{state.errors[field]?.[0]}</p>}</div>)}
      <p className={s.muted}>Usa al menos 12 caracteres. Una frase de varias palabras es fácil de recordar.</p><button className={s.primary} disabled={pending}>{pending?'Guardando…':'Guardar contraseña y entrar'}</button>
    </fieldset>
  </form>;
}
