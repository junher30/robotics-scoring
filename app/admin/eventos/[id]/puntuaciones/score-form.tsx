'use client';
import {useActionState,useEffect,useRef,useState} from 'react';
import {saveScore} from './actions';
import {saveJudgeScore} from '../../../../judge/actions';
import {calculatePoints,formatPoints,scoreSchema,type Challenge,type Score,type FormState,type ScoringRule} from '../../../../../lib/scoring/schema';
import s from '../../events.module.css';
import styles from './scoring.module.css';
export function ScoreForm({eventId,teamId,challenge,score,rule,locked,actor='admin'}:{eventId:string;teamId:string;challenge:Challenge;score?:Score;rule:ScoringRule;locked:boolean;actor?:'admin'|'judge'}){
 const [state,action,pending]=useActionState<FormState,FormData>((actor==='judge'?saveJudgeScore:saveScore).bind(null,eventId,teamId,challenge.id,score?.updated_at??null),{});
 const [attempt,setAttempt]=useState(score?String(score.attempt):'');const [seconds,setSeconds]=useState(score?String(score.seconds):'');const [completed,setCompleted]=useState(score?.completed??true);
 const notice=useRef<HTMLDivElement>(null);useEffect(()=>{if(state.message)notice.current?.focus();},[state]);
 const parsed=scoreSchema.safeParse({attempt,seconds,completed:String(completed),notes:''});const preview=parsed.success?calculatePoints(rule,Number(parsed.data.attempt),Number(parsed.data.seconds),completed):null;
 const prefix=challenge.id;const error=(key:string)=>state.errors?.[key]?.[0];
 return <form action={action} noValidate aria-busy={pending} className={s.card}><div className={styles.cardHeader}><div><h2>{challenge.name}</h2><p className={s.muted}>{score?`Guardado: ${formatPoints(score.points)} puntos`:'Pendiente de calificar'}</p></div><output className={styles.preview} aria-live="polite">{preview===null?'—':formatPoints(preview)}<small>puntos previstos</small></output></div>
 {state.message&&<div ref={notice} tabIndex={-1} role="alert" className={s.error}>{state.message}</div>}<fieldset disabled={pending||locked} className={s.formFields}><div className={s.grid}><div className={s.field}><label htmlFor={`${prefix}-attempt`}>Número de intento</label><input id={`${prefix}-attempt`} name="attempt" type="number" min={0} max={2147483647} step={1} value={attempt} onChange={e=>setAttempt(e.target.value)} aria-invalid={Boolean(error('attempt'))}/>{error('attempt')&&<p className={s.fieldError}>{error('attempt')}</p>}</div><div className={s.field}><label htmlFor={`${prefix}-seconds`}>Tiempo total (segundos)</label><input id={`${prefix}-seconds`} name="seconds" inputMode="decimal" value={seconds} onChange={e=>setSeconds(e.target.value)} placeholder="Ej. 65,250" aria-invalid={Boolean(error('seconds'))}/>{error('seconds')&&<p className={s.fieldError}>{error('seconds')}</p>}</div></div>
 {rule==='EXCEL_2026'?<input type="hidden" name="completed" value="true"/>:<div className={s.field}><label htmlFor={`${prefix}-completed`}>Reto logrado</label><select id={`${prefix}-completed`} name="completed" value={String(completed)} onChange={e=>setCompleted(e.target.value==='true')}><option value="true">Sí</option><option value="false">No</option></select></div>}
 <p className={s.muted}>{rule==='EXCEL_2026'?'Usa intento 0 para registrar un reto sin puntos. ':'Las reglas antiguas usan “Reto logrado” para decidir si puntúa. '}Convierte minutos a segundos: 1 minuto y 5,250 segundos = 65,250. El tercer intento y los siguientes usan base 130.</p>
 <div className={s.field}><label htmlFor={`${prefix}-notes`}>{score?'Motivo de la corrección *':'Observaciones (opcional)'}</label><textarea id={`${prefix}-notes`} name="notes" maxLength={1000} required={Boolean(score)} defaultValue={state.values?.notes??''} aria-invalid={Boolean(error('notes'))}/>{error('notes')&&<p className={s.fieldError}>{error('notes')}</p>}</div><button className={s.primary} disabled={pending||locked}>{pending?'Guardando…':score?'Guardar corrección':'Guardar puntuación'}</button></fieldset>
 </form>;
}
