'use client';
import {useActionState,useEffect,useRef,useState} from 'react';
import {parseInvitationFragment,type InvitationLink} from '../../../lib/auth/invitation-link';
import {acceptInvitationSession,type SessionState} from './session-actions';
import s from '../../admin/eventos/events.module.css';
import styles from './session-bridge.module.css';
function SessionForm({link}:{link:Extract<InvitationLink,{kind:'session'}>}){
 const [state,action,pending]=useActionState<SessionState,FormData>(acceptInvitationSession.bind(null,link.accessToken,link.refreshToken),{});
 return <form action={action} aria-busy={pending}>{state.message&&<p className={s.error} role="alert">{state.message}</p>}<button className={s.primary} disabled={pending}>{pending?'Preparando tu acceso…':'Continuar y crear mi contraseña'}</button></form>;
}
export function InvitationSessionBridge(){
 const [link,setLink]=useState<InvitationLink>(null);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(link&&!dialog.current?.open)dialog.current?.showModal();},[link]);
 useEffect(()=>{
  // The fragment is browser-only. Erase it from the address/history immediately,
  // retaining credentials only in memory until the user submits this form.
  const capture=()=>{const parsed=parseInvitationFragment(window.location.hash);if(!parsed)return;window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search);setLink(parsed);};
  capture();window.addEventListener('hashchange',capture);return()=>window.removeEventListener('hashchange',capture);
 },[]);
 if(!link)return null;
 return <dialog ref={dialog} className={styles.screen} aria-labelledby="invitation-session-title" onCancel={()=>setLink(null)}><section className={styles.card}><p className={s.muted}>TU INVITACIÓN A ROBOSCORE</p><h1 id="invitation-session-title">Completa tu acceso.</h1><p>Continúa para verificar tu cuenta invitada y elegir tu contraseña.</p>{link.kind==='session'?<SessionForm link={link}/>:<p className={s.error} role="alert">{link.message}</p>}<p className={s.muted}>No necesitas una contraseña anterior para completar este paso.</p><button className={s.secondary} onClick={()=>setLink(null)}>Cerrar</button></section></dialog>;
}
