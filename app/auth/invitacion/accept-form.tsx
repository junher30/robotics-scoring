'use client';
import {useActionState} from 'react';
import {acceptInvitation,type AcceptState} from './actions';
import s from '../../admin/eventos/events.module.css';
export function AcceptForm({token}:{token:string}) {
  const [state,action,pending]=useActionState<AcceptState,FormData>(acceptInvitation.bind(null,token),{});
  return <form action={action} aria-busy={pending}>{state.message&&<p role="alert" className={s.error}>{state.message}</p>}<button className={s.primary} disabled={pending}>{pending?'Confirmando…':'Aceptar invitación'}</button></form>;
}
