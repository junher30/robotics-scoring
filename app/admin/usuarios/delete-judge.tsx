'use client';
import {useActionState,useEffect,useRef,useState} from 'react';
import {deleteJudge,type DeleteJudgeState} from './delete-judge-actions';
import s from '../eventos/events.module.css';
export function DeleteJudge({id,version,name}:{id:string;version:string;name:string}){
 const [confirming,setConfirming]=useState(false);
 const [state,action,pending]=useActionState<DeleteJudgeState,FormData>(deleteJudge.bind(null,id,version),{});
 const notice=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if(state.message)notice.current?.focus();},[state]);
 return <section className={s.card} id="eliminar-juez" style={{borderColor:'#edb7bf'}}><h2>Eliminar juez</h2><p className={s.muted}>El juez dejará de aparecer en los listados y perderá el acceso a RoboScore. Sus puntuaciones e historial se conservan. Su correo seguirá asociado a la cuenta; no se libera para otra invitación.</p>{!confirming?<button type="button" className={s.secondary} style={{marginTop:20,color:'#a52437'}} onClick={()=>setConfirming(true)}>Eliminar juez…</button>:<form action={action} aria-busy={pending}><p style={{marginTop:20,overflowWrap:'anywhere'}}>Vas a eliminar a <strong>{name}</strong>.</p>{state.message&&<p ref={notice} tabIndex={-1} role="alert" className={s.error}>{state.message}</p>}<label className={s.checkbox}><input type="checkbox" name="confirm" value="yes" required disabled={pending}/> Confirmo que quiero eliminar a este juez y bloquear su acceso.</label><div className={s.actions}><button type="button" className={s.secondary} disabled={pending} onClick={()=>setConfirming(false)}>Cancelar</button><button className={s.primary} disabled={pending}>{pending?'Eliminando…':'Confirmar eliminación'}</button></div></form>}</section>;
}
