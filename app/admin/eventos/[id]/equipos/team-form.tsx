'use client';
import {useActionState,useEffect,useRef} from 'react';
import Link from 'next/link';
import {saveTeam} from './actions';
import type {Team,CategoryOption,FormState} from '../../../../../lib/scoring/schema';
import s from '../../events.module.css';
export function TeamForm({eventId,id,categories,team}:{eventId:string;id:string;categories:CategoryOption[];team?:Team}){
 const [state,action,pending]=useActionState<FormState,FormData>(saveTeam.bind(null,eventId,id,team?.updated_at??null),{});
 const alert=useRef<HTMLDivElement>(null);useEffect(()=>{if(state.message)alert.current?.focus();},[state]);
 const initial={name:team?.name??'',institution:team?.institution??'',robot_name:team?.robot_name??'',category_id:team?.category_id??'',active:team?.status==='REJECTED'?'false':'true'};
 const v=state.values??initial;
 const error=(key:string)=>state.errors?.[key]?.[0];
 return <form action={action} noValidate aria-busy={pending}>{state.message&&<div tabIndex={-1} ref={alert} role="alert" className={s.error}>{state.message}</div>}<fieldset disabled={pending} className={s.formFields}><section className={s.card}><h2>Datos del equipo</h2><p className={s.muted}>Añade el equipo directamente a una categoría. Los campos con * son obligatorios.</p>
 {(['name','institution','robot_name'] as const).map(key=><div className={s.field} key={key}><label htmlFor={key}>{key==='name'?'Nombre del equipo *':key==='institution'?'Institución *':'Nombre del robot (opcional)'}</label><input id={key} name={key} defaultValue={v[key]} maxLength={key==='institution'?200:150} aria-invalid={Boolean(error(key))} aria-describedby={error(key)?`${key}-error`:undefined}/>{error(key)&&<p id={`${key}-error`} className={s.fieldError}>{error(key)}</p>}</div>)}
 <div className={s.grid}><div className={s.field}><label htmlFor="category_id">Categoría *</label><select id="category_id" name="category_id" defaultValue={v.category_id} aria-invalid={Boolean(error('category_id'))}><option value="">Selecciona una categoría</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}{c.status==='CLOSED'?' · Cerrada':''}</option>)}</select>{error('category_id')&&<p className={s.fieldError}>{error('category_id')}</p>}</div><div className={s.field}><label htmlFor="active">Participación</label><select id="active" name="active" defaultValue={v.active}><option value="true">Participa</option><option value="false">Retirado</option></select></div></div><p className={s.muted}>Retirar conserva las puntuaciones y excluye al equipo de la clasificación. Un equipo ya puntuado conserva su categoría.</p></section><div className={s.actions}><Link className={s.secondary} href={`/admin/eventos/${eventId}/equipos`}>Volver a equipos</Link><button className={s.primary} disabled={pending}>{pending?'Guardando…':team?'Guardar cambios':'Crear equipo'}</button></div></fieldset></form>;
}
