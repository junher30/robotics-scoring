'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { login } from './actions';
import type { LoginState } from '../../lib/auth/validation';
import styles from './login.module.css';
export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [visible, setVisible] = useState(false);
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state.message || state.errors) notice.current?.focus(); }, [state]);
  return <form action={action} className={styles.form} noValidate aria-busy={pending}>
    {(state.message || state.errors) && <div ref={notice} tabIndex={-1} className={styles.error} role="alert">{state.message ?? 'Revisa los campos indicados para continuar.'}</div>}
    <div className={styles.field}><label htmlFor="email">Correo electrónico</label><input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="tu@correo.com" defaultValue={state.email ?? ''} maxLength={254} required aria-invalid={Boolean(state.errors?.email)} aria-describedby={state.errors?.email ? 'email-error' : undefined} disabled={pending}/>{state.errors?.email && <p id="email-error" className={styles.fieldError}>{state.errors.email[0]}</p>}</div>
    <div className={styles.field}><label htmlFor="password">Contraseña</label><div className={styles.password}><input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Tu contraseña" maxLength={256} required aria-invalid={Boolean(state.errors?.password)} aria-describedby={state.errors?.password ? 'password-error' : undefined} disabled={pending}/><button type="button" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible} onClick={()=>setVisible(!visible)} disabled={pending}>{visible ? 'Ocultar' : 'Mostrar'}</button></div>{state.errors?.password && <p id="password-error" className={styles.fieldError}>{state.errors.password[0]}</p>}</div>
    <label className={styles.remember}><input type="checkbox" name="remember" defaultChecked={state.remember ?? false} disabled={pending}/><span>Recordarme en este dispositivo</span></label>
    <button type="submit" className={styles.submit} disabled={pending}>{pending ? 'Iniciando sesión…' : 'Iniciar sesión'}<span aria-hidden="true">{pending ? '…' : '→'}</span></button>
    <p className={styles.note}>Si compartes este dispositivo, deja “Recordarme” desmarcado y cierra sesión al terminar.</p>
  </form>;
}
