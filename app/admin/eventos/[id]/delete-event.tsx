'use client';
import {useActionState,useEffect,useRef,useState} from 'react';
import {deleteEvent,type DeleteEventState} from './delete-actions';
import s from '../events.module.css';
export function DeleteEvent({id,name}:{id:string;name:string}){
 const [confirming,setConfirming]=useState(false);
 const [state,action,pending]=useActionState<DeleteEventState,FormData>(deleteEvent.bind(null,id),{});
 const notice=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if(state.message)notice.current?.focus();},[state]);
 return <section className={s.card} style={{borderColor:'#edb7bf'}}><h2>Eliminar evento</h2><p className={s.muted}>Borra el evento por completo, sin dejar historial. Solo funciona porque este evento no tiene categorías, equipos ni puntuaciones todavía; si ya tiene datos reales, cancélalo desde su estado en vez de eliminarlo.</p>{!confirming?<button type="button" className={s.secondary} style={{marginTop:20,color:'#a52437'}} onClick={()=>setConfirming(true)}>Eliminar evento…</button>:<form action={action} aria-busy={pending}><p style={{marginTop:20,overflowWrap:'anywhere'}}>Vas a eliminar <strong>{name}</strong> de forma permanente.</p>{state.message&&<p ref={notice} tabIndex={-1} role="alert" className={s.error}>{state.message}</p>}<label className={s.checkbox}><input type="checkbox" name="confirm" value="yes" required disabled={pending}/> Confirmo que quiero eliminar este evento de forma permanente.</label><div className={s.actions}><button type="button" className={s.secondary} disabled={pending} onClick={()=>setConfirming(false)}>Cancelar</button><button className={s.primary} disabled={pending}>{pending?'Eliminando…':'Confirmar eliminación'}</button></div></form>}</section>;
}
