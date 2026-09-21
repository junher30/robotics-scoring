# Equipos y puntuación · Código completo del módulo

Código de esta entrega. Los archivos originales del proyecto son la fuente de verdad. No incluye variables de entorno ni credenciales.

## app/admin/eventos/[id]/equipos/[teamId]/page.tsx

````tsx
import {eventContext,readTeam} from '../../../../../../lib/scoring/read';
import {TeamForm} from '../team-form';
import {EventShell} from '../../../shell';
import {EventNavigation} from '../../../event-navigation';
import s from '../../../events.module.css';
export default async function Page({params,searchParams}:{params:Promise<{id:string;teamId:string}>;searchParams:Promise<{guardado?:string}>}){const {id,teamId}=await params,{event,categories}=await eventContext(id),team=await readTeam(id,teamId);return <EventShell><header className={s.title}><p>{event.name}</p><h1>{team.name}</h1></header><EventNavigation eventId={id} current="teams"/>{(await searchParams).guardado==='1'&&<p role="status" className={s.success}>Equipo guardado.</p>}<TeamForm eventId={id} id={teamId} categories={categories} team={team}/></EventShell>;}

````

## app/admin/eventos/[id]/equipos/actions.ts

````ts
'use server';
import {z} from 'zod';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireAccess} from '../../../../../lib/auth/authorization';
import {createClient} from '../../../../../lib/supabase/server';
import {teamSchema,type FormState} from '../../../../../lib/scoring/schema';
export async function saveTeam(eventId:string,id:string,version:string|null,_previous:FormState,form:FormData):Promise<FormState>{
 await requireAccess('admin');
 const values=Object.fromEntries(['category_id','name','institution','robot_name','active'].map(key=>[key,String(form.get(key)??'')]));
 const parsed=teamSchema.safeParse(values);
 if(!parsed.success)return {values,message:'Revisa los campos indicados.',errors:parsed.error.flatten().fieldErrors};
 if(![eventId,id].every(v=>z.string().uuid().safeParse(v).success)||(version!==null&&!z.string().datetime({offset:true}).safeParse(version).success))return {values,message:'Abre de nuevo el formulario.'};
 try{const client=await createClient(),v=parsed.data;const {data,error}=await client.rpc('roboscore_save_team',{p_event:eventId,p_id:id,p_version:version,p_category:v.category_id,p_name:v.name,p_institution:v.institution,p_robot:v.robot_name,p_active:v.active==='true'});
 if(error)return {values,message:['42501','22023','23505','40001'].includes(error.code)?error.message:'No se pudo guardar. Revisa la conexión y el SQL de equipos.'};if(data!==id)return {values,message:'No se pudo confirmar el guardado. Recarga el listado.'};
 }catch{return {values,message:'No pudimos confirmar la operación. Conserva los datos y revisa el listado antes de reintentar.'};}
 revalidatePath(`/admin/eventos/${eventId}`,'layout');revalidatePath('/admin');redirect(`/admin/eventos/${eventId}/equipos/${id}?guardado=1`);
}

````

## app/admin/eventos/[id]/equipos/nuevo/page.tsx

````tsx
import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {eventContext} from '../../../../../../lib/scoring/read';
import {TeamForm} from '../team-form';
import {EventShell} from '../../../shell';
import {EventNavigation} from '../../../event-navigation';
import s from '../../../events.module.css';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params,{event,categories}=await eventContext(id);return <EventShell><header className={s.title}><p>{event.name}</p><h1>Nuevo equipo.</h1></header><EventNavigation eventId={id} current="teams"/>{categories.length?<TeamForm eventId={id} id={randomUUID()} categories={categories}/>:<div className={s.empty}><h2>Primero crea una categoría</h2><p>Cada equipo debe pertenecer a una categoría del evento.</p><Link className={s.primary} href={`/admin/eventos/${id}/categorias/nueva`}>Crear categoría</Link></div>}</EventShell>;}

````

## app/admin/eventos/[id]/equipos/page.tsx

````tsx
import type {Metadata} from 'next';
import Link from 'next/link';
import {eventContext,teamColumns} from '../../../../../lib/scoring/read';
import type {Team} from '../../../../../lib/scoring/schema';
import {createClient} from '../../../../../lib/supabase/server';
import {EventShell} from '../../shell';
import {EventNavigation} from '../../event-navigation';
import s from '../../events.module.css';
export const metadata:Metadata={title:'Equipos | RoboScore',robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{categoria?:string;pagina?:string}>}){
 const {id}=await params,{event,categories}=await eventContext(id),query=await searchParams;
 const category=categories.find(c=>c.id===query.categoria);const page=/^[1-9]\d{0,5}$/.test(query.pagina??'')?Number(query.pagina):1;
 let rows:Team[]=[],count=0,failed=false;
 try{const client=await createClient();let request=client.from('teams').select(teamColumns,{count:'exact'}).eq('event_id',id).order('name').order('id').range((page-1)*20,page*20-1);if(category)request=request.eq('category_id',category.id);const result=await request.returns<Team[]>();rows=result.data??[];count=result.count??0;failed=Boolean(result.error);}catch{failed=true;}
 const base=`/admin/eventos/${id}/equipos`;const pageUrl=(n:number)=>`${base}?${new URLSearchParams({...(category?{categoria:category.id}:{}),pagina:String(n)})}`;
 return <EventShell><header className={s.title}><p>TU COMPETENCIA</p><h1>{event.name}</h1><span>Organiza los equipos que participan en cada categoría.</span></header><EventNavigation eventId={id} current="teams"/><div className={s.titleRow}><h2>Equipos</h2><Link className={s.primary} href={`${base}/nuevo`}>+ Nuevo equipo</Link></div><form className={s.filters}><label htmlFor="categoria">Categoría</label><select name="categoria" id="categoria" defaultValue={category?.id??''}><option value="">Todas</option>{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select><button className={s.secondary}>Filtrar</button></form>
 {failed?<p role="alert" className={s.error}>No pudimos cargar los equipos. Revisa la conexión y el SQL de equipos.</p>:<><p className={s.muted}>{count} equipos · Página {page}</p>{rows.length===0?<section className={s.empty}><h2>Los equipos aparecerán aquí</h2><p>Crea un equipo y elige su categoría para empezar.</p><Link className={s.primary} href={`${base}/nuevo`}>Añadir equipo</Link></section>:<div className={s.list}>{rows.map(t=><article key={t.id} className={s.event}><div><span className={s.badge}>{t.status==='REJECTED'?'Retirado':t.status==='ACTIVE'?'Participa':'Por activar'}</span><h2>{t.name}</h2><p>{t.institution} · {categories.find(c=>c.id===t.category_id)?.name}</p>{t.robot_name&&<p>Robot: {t.robot_name}</p>}</div><div className={s.actions}><Link className={s.secondary} href={`${base}/${t.id}`}>Editar</Link>{t.status==='ACTIVE'&&<Link className={s.primary} href={`/admin/eventos/${id}/puntuaciones/${t.id}`}>Puntuar →</Link>}</div></article>)}</div>}<nav className={s.pagination} aria-label="Páginas de equipos">{page>1&&<Link className={s.secondary} href={pageUrl(page-1)}>Anterior</Link>}{page*20<count&&<Link className={s.secondary} href={pageUrl(page+1)}>Siguiente</Link>}</nav></>}
 </EventShell>;
}

````

## app/admin/eventos/[id]/equipos/team-form.tsx

````tsx
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

````

## app/admin/eventos/[id]/puntuaciones/[teamId]/page.tsx

````tsx
import Link from 'next/link';
import {eventContext,readTeam} from '../../../../../../lib/scoring/read';
import {createClient} from '../../../../../../lib/supabase/server';
import {formatPoints,ruleLabels,type Board,type Score,type Challenge} from '../../../../../../lib/scoring/schema';
import {EventShell} from '../../../shell';
import {EventNavigation} from '../../../event-navigation';
import {ScoreForm} from '../score-form';
import s from '../../../events.module.css';
import styles from '../scoring.module.css';
type Revision={id:number;created_at:string;old_data:{points:number}|null;new_data:{points:number;notes:string}};
export default async function Page({params,searchParams}:{params:Promise<{id:string;teamId:string}>;searchParams:Promise<{guardado?:string}>}){
 const {id,teamId}=await params,{event,categories}=await eventContext(id),team=await readTeam(id,teamId),category=categories.find(c=>c.id===team.category_id)!;
 const client=await createClient();
 const [configResult,challengesResult,scoresResult]=await Promise.all([
  client.from('category_scoring').select('rule,challenge_count').eq('category_id',team.category_id).maybeSingle<NonNullable<Board['config']>>(),
  client.from('event_challenges').select('id,name,sort_order').eq('category_id',team.category_id).eq('active',true).order('sort_order').returns<Challenge[]>(),
  client.from('team_scores').select('id,challenge_id,attempt,seconds,completed,points,notes,updated_at').eq('team_id',team.id).returns<Score[]>()]);
 if(configResult.error||challengesResult.error||scoresResult.error)throw Error('No se pudieron cargar los datos de puntuación.');
 const config=configResult.data,challenges=challengesResult.data??[],scores=scoresResult.data??[];
 let history:Revision[]=[];let historyFailed=false;if(scores.length){const result=await client.from('score_revisions').select('id,created_at,old_data,new_data').in('score_id',scores.map(score=>score.id)).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(10).returns<Revision[]>();history=result.data??[];historyFailed=Boolean(result.error);}
 const locked=event.status!=='ACTIVE'||category.status!=='ACTIVE'||team.status!=='ACTIVE';
 return <EventShell><header className={s.title}><p>{event.name} · {category.name}</p><h1>{team.name}</h1><span>{team.institution}{config?` · ${ruleLabels[config.rule]}`:''}</span></header><EventNavigation eventId={id} current="scores"/>{(await searchParams).guardado==='1'&&<p role="status" className={s.success}>Puntuación guardada. La clasificación ya refleja el cambio.</p>}
 <p className={s.muted}><Link href={`/admin/eventos/${id}/puntuaciones?categoria=${category.id}`}>← Volver a la clasificación</Link></p>
 {!config?<div className={s.empty}><h2>Configura los retos de esta categoría</h2><p>Selecciona la fórmula del Excel y el número de retos antes de puntuar.</p><Link className={s.primary} href={`/admin/eventos/${id}/puntuaciones?categoria=${category.id}`}>Configurar puntuación</Link></div>:<>{locked&&<p className={s.error} role="status">Para guardar puntuaciones, el evento y la categoría deben estar activos y el equipo debe participar.</p>}{challenges.map(challenge=><ScoreForm key={`${challenge.id}-${scores.find(score=>score.challenge_id===challenge.id)?.updated_at??'new'}`} eventId={id} teamId={team.id} challenge={challenge} score={scores.find(score=>score.challenge_id===challenge.id)} rule={config.rule} locked={locked}/>)}</>}
 {historyFailed?<p role="alert" className={s.error}>No pudimos consultar el historial de cambios.</p>:history.length>0&&<section className={s.card}><h2>Últimos cambios</h2><p className={s.muted}>Hasta 10 registros recientes. Las correcciones conservan el valor anterior.</p><ol className={styles.history}>{history.map(h=><li key={h.id}><time dateTime={h.created_at}>{new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',dateStyle:'short',timeStyle:'short'}).format(new Date(h.created_at))}</time> · {h.old_data?`${formatPoints(h.old_data.points)} → `:''}{formatPoints(h.new_data.points)} puntos{h.new_data.notes?` · ${h.new_data.notes}`:''}</li>)}</ol></section>}
 </EventShell>;
}

````

## app/admin/eventos/[id]/puntuaciones/actions.ts

````ts
'use server';
import {z} from 'zod';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireAccess} from '../../../../../lib/auth/authorization';
import {createClient} from '../../../../../lib/supabase/server';
import {configSchema,scoreSchema,type FormState} from '../../../../../lib/scoring/schema';
const uuid=(value:string)=>z.string().uuid().safeParse(value).success;
const message=(error:{code:string;message:string})=>['42501','22023','40001'].includes(error.code)?error.message:'No se pudo guardar. Revisa la conexión y la configuración de puntuaciones.';
export async function configureScoring(eventId:string,categoryId:string,_previous:FormState,form:FormData):Promise<FormState>{
 await requireAccess('admin');const values={rule:String(form.get('rule')??''),count:String(form.get('count')??'')};const parsed=configSchema.safeParse(values);
 if(!parsed.success||!uuid(eventId)||!uuid(categoryId))return {values,message:'Selecciona una regla y entre 1 y 20 retos.'};
 try{const client=await createClient();const {error}=await client.rpc('roboscore_configure_scoring',{p_event:eventId,p_category:categoryId,p_rule:parsed.data.rule,p_count:parsed.data.count});if(error)return {values,message:message(error)};}catch{return {values,message:'No se pudo confirmar la configuración. Recarga antes de reintentar.'};}
 revalidatePath(`/admin/eventos/${eventId}`,'layout');redirect(`/admin/eventos/${eventId}/puntuaciones?categoria=${categoryId}&guardado=1`);
}
export async function saveScore(eventId:string,teamId:string,challengeId:string,version:string|null,_previous:FormState,form:FormData):Promise<FormState>{
 await requireAccess('admin');const values=Object.fromEntries(['attempt','seconds','completed','notes'].map(k=>[k,String(form.get(k)??'')]));const parsed=scoreSchema.safeParse(values);
 if(!parsed.success)return {values,message:'Revisa los campos indicados.',errors:parsed.error.flatten().fieldErrors};
 if(![eventId,teamId,challengeId].every(uuid)||(version!==null&&!z.string().datetime({offset:true}).safeParse(version).success))return {values,message:'Abre de nuevo la ficha del equipo.'};
 if(version&&!parsed.data.notes)return {values,message:'Explica el motivo de la corrección.',errors:{notes:['Escribe qué estás corrigiendo.']}};
 try{const client=await createClient(),v=parsed.data;const {error}=await client.rpc('roboscore_save_score',{p_event:eventId,p_team:teamId,p_challenge:challengeId,p_version:version,p_attempt:Number(v.attempt),p_seconds:Number(v.seconds),p_completed:v.completed==='true',p_notes:v.notes});if(error)return {values,message:message(error)};}catch{return {values,message:'No se pudo confirmar la puntuación. Recarga para comprobar si se guardó.'};}
 revalidatePath(`/admin/eventos/${eventId}`,'layout');redirect(`/admin/eventos/${eventId}/puntuaciones/${teamId}?guardado=1`);
}

````

## app/admin/eventos/[id]/puntuaciones/config-form.tsx

````tsx
'use client';
import {useActionState} from 'react';
import {configureScoring} from './actions';
import {ruleLabels,type Board,type FormState} from '../../../../../lib/scoring/schema';
import s from '../../events.module.css';
export function ConfigForm({eventId,categoryId,config,locked}:{eventId:string;categoryId:string;config:Board['config'];locked:boolean}){
 const [state,action,pending]=useActionState<FormState,FormData>(configureScoring.bind(null,eventId,categoryId),{});
 return <form action={action} aria-busy={pending}><section className={s.card}><h2>Regla de puntuación</h2>{state.message&&<p role="alert" className={s.error}>{state.message}</p>}<p className={s.muted}>Elige la hoja de referencia. CATA tiene 4 retos; CATB, CATC y CATD tienen 3. La regla y el número de retos quedan fijos al guardar la primera puntuación.</p><fieldset className={s.formFields} disabled={pending||locked}><div className={s.grid}><div className={s.field}><label htmlFor="rule">Fórmula del Excel</label><select name="rule" id="rule" required defaultValue={state.values?.rule??config?.rule??''}><option value="">Selecciona la regla</option>{Object.entries(ruleLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div><div className={s.field}><label htmlFor="count">Número de retos</label><input type="number" name="count" id="count" min={1} max={20} required defaultValue={state.values?.count??config?.challenge_count??3}/></div></div><p className={s.muted}>Se resta el tiempo total en segundos. CATA–CATD da 0 puntos con intento 0. Las reglas antiguas usan además “Reto logrado”; con intento 0 y reto logrado aplican la base 130. Se conservan los valores negativos del Excel.</p><button className={s.primary} disabled={pending||locked}>{pending?'Guardando…':config?'Actualizar configuración':'Configurar retos'}</button></fieldset>{locked&&<p className={s.muted}>Configuración bloqueada: ya hay puntuaciones o el evento o categoría están cerrados.</p>}</section></form>;
}

````

## app/admin/eventos/[id]/puntuaciones/page.tsx

````tsx
import type {Metadata} from 'next';
import Link from 'next/link';
import {eventContext,readBoard} from '../../../../../lib/scoring/read';
import {formatPoints,type Board} from '../../../../../lib/scoring/schema';
import {EventShell} from '../../shell';
import {EventNavigation} from '../../event-navigation';
import {ConfigForm} from './config-form';
import s from '../../events.module.css';
import styles from './scoring.module.css';
export const metadata:Metadata={title:'Puntuaciones | RoboScore',robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{categoria?:string;guardado?:string;pagina?:string}>}){
 const {id}=await params,{event,categories}=await eventContext(id),query=await searchParams;const category=categories.find(c=>c.id===query.categoria)??categories[0];
 let board:Board|null=null,failed=false;if(category){try{board=await readBoard(id,category.id);}catch{failed=true;}}
 const base=`/admin/eventos/${id}/puntuaciones`;const page=/^[1-9]\d{0,5}$/.test(query.pagina??'')?Number(query.pagina):1;const teams=board?.teams.slice((page-1)*20,page*20)??[];
 return <EventShell><header className={s.title}><p>{event.name}</p><h1>Puntuaciones.</h1><span>Configura los retos, califica los equipos y consulta su clasificación.</span></header><EventNavigation eventId={id} current="scores"/>
 {categories.length?<form className={s.filters}><label htmlFor="categoria">Categoría</label><select id="categoria" name="categoria" defaultValue={category?.id}>{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select><button className={s.secondary}>Ver categoría</button><Link className={s.textLink} href={`${base}?categoria=${category.id}`}>Actualizar resultados</Link></form>:<div className={s.empty}><h2>Primero crea una categoría</h2><p>Después podrás añadir equipos y configurar sus retos.</p><Link className={s.primary} href={`/admin/eventos/${id}/categorias/nueva`}>Crear categoría</Link></div>}
 {query.guardado==='1'&&<p role="status" className={s.success}>Configuración guardada.</p>}{failed&&<p role="alert" className={s.error}>No pudimos cargar las puntuaciones. Comprueba la conexión y que esté aplicado el SQL de equipos y puntuación.</p>}
 {board&&category&&<><ConfigForm key={category.id} eventId={id} categoryId={category.id} config={board.config} locked={board.has_scores||category.status==='CLOSED'||['FINISHED','CANCELLED'].includes(event.status)}/>
 <h2 className={styles.heading}>Clasificación · {category.name}</h2><p className={s.muted}>La suma de los retos determina el total. Los empates comparten posición. “Parcial” indica que faltan retos; un equipo sin calificar aparece sin puntuación. Resultados actualizados al abrir o recargar esta página.</p>
 {teams.length?<div className={styles.tableWrap} role="region" aria-label="Clasificación de equipos" tabIndex={0}><table className={styles.table}><thead><tr><th>Pos.</th><th>Equipo</th><th>Retos</th><th>Total</th><th>Acción</th></tr></thead><tbody>{teams.map(t=><tr key={t.id}><td>{t.position??'—'}</td><td>{t.name}<small>{t.institution}</small></td><td>{t.scored_count}/{board.challenges.length}<small>{t.scored_count===0?'Sin calificar':t.scored_count<board.challenges.length?'Parcial':'Completo'}</small></td><td className={styles.points}>{t.total===null?'—':formatPoints(t.total)}</td><td><Link href={`${base}/${t.id}`}>Puntuar →</Link></td></tr>)}</tbody></table></div>:<div className={s.empty}><h2>No hay equipos en esta vista</h2><p>Añade equipos participantes o vuelve a la primera página.</p><Link className={s.primary} href={`/admin/eventos/${id}/equipos`}>Ver equipos</Link></div>}
 <nav className={s.pagination} aria-label="Páginas de clasificación">{page>1&&<Link className={s.secondary} href={`${base}?categoria=${category.id}&pagina=${page-1}`}>Anterior</Link>}{page*20<board.teams.length&&<Link className={s.secondary} href={`${base}?categoria=${category.id}&pagina=${page+1}`}>Siguiente</Link>}</nav></>}
 </EventShell>;
}

````

## app/admin/eventos/[id]/puntuaciones/score-form.tsx

````tsx
'use client';
import {useActionState,useEffect,useRef,useState} from 'react';
import {saveScore} from './actions';
import {calculatePoints,formatPoints,scoreSchema,type Challenge,type Score,type FormState,type ScoringRule} from '../../../../../lib/scoring/schema';
import s from '../../events.module.css';
import styles from './scoring.module.css';
export function ScoreForm({eventId,teamId,challenge,score,rule,locked}:{eventId:string;teamId:string;challenge:Challenge;score?:Score;rule:ScoringRule;locked:boolean}){
 const [state,action,pending]=useActionState<FormState,FormData>(saveScore.bind(null,eventId,teamId,challenge.id,score?.updated_at??null),{});
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

````

## app/admin/eventos/[id]/puntuaciones/scoring.module.css

````css
.cardHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:24px}.preview{color:#b92535;text-align:right;font-size:30px;font-weight:750;white-space:nowrap}.preview small{display:block;font-size:11px;font-weight:400;color:#788398;margin-top:8px}.tableWrap{overflow-x:auto;background:white;border:1px solid #e4e8ef;border-radius:14px;margin:20px 0}.table{width:100%;border-collapse:collapse;font-size:14px;min-width:580px}.table th{text-align:left;color:#778196;background:#fafbfc;font-size:12px;font-weight:600}.table td,.table th{padding:18px 20px;border-bottom:1px solid #edf0f4}.table td small{display:block;color:#7c8797;font-size:12px;margin-top:7px}.table td a{color:#ae2937}.points{font-size:18px;font-weight:750;color:#b92535}.history{font-size:13px;line-height:1.8;padding-left:20px}.history li{padding:9px 0;overflow-wrap:anywhere}.emptyTotal{color:#8390a2}.heading{font-size:23px;font-weight:700;margin:32px 0 10px}@media(max-width:450px){.cardHeader{gap:12px}.preview{font-size:24px}.table td,.table th{padding:14px 12px}}

````

## app/admin/eventos/[id]/error.tsx

````tsx
'use client';
import Link from 'next/link';
import s from '../events.module.css';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className={s.main}><section className={s.empty}><h1>No pudimos cargar el evento</h1><p>Comprueba la conexión y que las migraciones de este módulo estén aplicadas.</p><button className={s.primary} onClick={reset}>Reintentar</button> <Link className={s.secondary} href="/admin/eventos">Volver a eventos</Link></section></main>;}

````

## app/admin/eventos/event-navigation.tsx

````tsx
import Link from 'next/link';
import styles from './event-navigation.module.css';

export function EventNavigation({ eventId, current }: { eventId: string; current: 'info' | 'categories' | 'teams' | 'scores' }) {
  return <nav className={styles.nav} aria-label="Secciones del evento">
    <Link href={`/admin/eventos/${eventId}`} aria-current={current === 'info' ? 'page' : undefined}>Información</Link>
    <Link href={`/admin/eventos/${eventId}/categorias`} aria-current={current === 'categories' ? 'page' : undefined}>Categorías</Link>
    <Link href={`/admin/eventos/${eventId}/equipos`} aria-current={current === 'teams' ? 'page' : undefined}>Equipos</Link>
    <Link href={`/admin/eventos/${eventId}/puntuaciones`} aria-current={current === 'scores' ? 'page' : undefined}>Puntuaciones</Link>
  </nav>;
}

````

## lib/scoring/read.ts

````ts
import 'server-only';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {categoryEvent} from '../categories/read';
import {createClient} from '../supabase/server';
import type {Team,CategoryOption,Board} from './schema';
export const teamColumns='id,event_id,category_id,name,institution,robot_name,status,updated_at';
export async function eventContext(id:string) {
 const event=await categoryEvent(id);
 const client=await createClient();
 // Page explicitly to avoid the Data API default row limit hiding categories.
 const categories:CategoryOption[]=[];
 for(let from=0;;from+=500){const {data,error}=await client.from('event_categories').select('id,name,status').eq('event_id',id).order('sort_order').order('id').range(from,from+499).returns<CategoryOption[]>();if(error)throw Error('No se pudieron consultar las categorías.');categories.push(...(data??[]));if(!data||data.length<500)break;}
 return {event,categories};
}
export async function readTeam(eventId:string,id:string) {
 await categoryEvent(eventId);
 if(!z.string().uuid().safeParse(id).success)notFound();
 const client=await createClient();
 const {data,error}=await client.from('teams').select(teamColumns).eq('event_id',eventId).eq('id',id).maybeSingle<Team>();
 if(error)throw Error('No se pudo cargar el equipo.');if(!data)notFound();return data;
}
export async function readBoard(eventId:string,categoryId:string):Promise<Board> {
 await categoryEvent(eventId);
 if(!z.string().uuid().safeParse(categoryId).success)notFound();
 const client=await createClient();const {data,error}=await client.rpc('roboscore_scoring_board',{p_event:eventId,p_category:categoryId});
 if(error||!data)throw Error('No se pudieron consultar las puntuaciones.');return data as Board;
}

````

## lib/scoring/schema.ts

````ts
import {z} from 'zod';
export const ruleLabels={EXCEL_2026:'CATA–CATD · 170 / 150 / 130',LEGACY_C:'CATEGORIA C antigua · 170 / 90 / 130',LEGACY_D:'CATEGORIA D antigua · 170 / 150 / 130'};
export type ScoringRule=keyof typeof ruleLabels;
export const teamSchema=z.object({category_id:z.string().uuid('Selecciona una categoría.'),name:z.string().trim().min(1,'Escribe el nombre.').max(150),institution:z.string().trim().min(1,'Escribe la institución.').max(200),robot_name:z.string().trim().max(150),active:z.enum(['true','false'])});
export const configSchema=z.object({rule:z.enum(['EXCEL_2026','LEGACY_C','LEGACY_D']),count:z.coerce.number().int().min(1).max(20)});
export const scoreSchema=z.object({attempt:z.string().regex(/^\d+$/,'Escribe un intento entero, desde 0.').refine(v=>Number(v)<=2147483647,'El intento es demasiado grande.'),seconds:z.string().trim().transform(v=>v.replace(',','.')).refine(v=>/^\d+(\.\d{1,3})?$/.test(v)&&Number(v)<=999999999.999,'Escribe segundos positivos o cero, con hasta 3 decimales.'),completed:z.enum(['true','false']),notes:z.string().trim().max(1000,'Usa como máximo 1000 caracteres.')});
export type FormState={message?:string;errors?:Record<string,string[]|undefined>;values?:Record<string,string>};
export type Team={id:string;event_id:string;category_id:string;name:string;institution:string;robot_name:string|null;status:'PENDING'|'APPROVED'|'ACTIVE'|'REJECTED';updated_at:string};
export type CategoryOption={id:string;name:string;status:string};
export type Score={id:string;challenge_id:string;attempt:number;seconds:number;completed:boolean;points:number;notes:string;updated_at:string};
export type Challenge={id:string;name:string;sort_order:number};
export type Board={has_scores:boolean;config:{rule:ScoringRule;challenge_count:number}|null;challenges:Challenge[];teams:{id:string;name:string;institution:string;scored_count:number;total:number|null;position:number|null;scores:Score[]}[]};
export function calculatePoints(rule:ScoringRule,attempt:number,seconds:number,completed:boolean):number {
 if((rule==='EXCEL_2026'&&attempt===0)||(rule!=='EXCEL_2026'&&!completed))return 0;
 const base=attempt===1?170:attempt===2?(rule==='LEGACY_C'?90:150):130;
 return Math.round((base-seconds)*1000)/1000;
}
export const formatPoints=(value:number)=>new Intl.NumberFormat('es-CO',{maximumFractionDigits:3}).format(value);

````

## supabase/migrations/202609210001_teams_scoring.sql

````sql
-- Equipos y puntuación administrativa. Repetible. Requiere fases 3, 4, 9 y 10.
BEGIN;
CREATE OR REPLACE FUNCTION roboscore_private.can_manage_event(p_event uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.events e JOIN public.profiles p ON p.id=auth.uid()
 WHERE e.id=p_event AND p.active AND (p.role='SUPER_ADMIN' OR (p.role='ADMIN' AND e.created_by=p.id)));
$$;
REVOKE ALL ON FUNCTION roboscore_private.can_manage_event(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION roboscore_private.can_manage_event(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.roboscore_score_points(p_rule text,p_attempt integer,p_seconds numeric,p_completed boolean)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN p_rule='EXCEL_2026' AND p_attempt=0 THEN 0
 WHEN p_rule IN ('LEGACY_C','LEGACY_D') AND NOT p_completed THEN 0
 ELSE (CASE WHEN p_attempt=1 THEN 170 WHEN p_attempt=2 THEN CASE WHEN p_rule='LEGACY_C' THEN 90 ELSE 150 END ELSE 130 END)-p_seconds END;
$$;
REVOKE ALL ON FUNCTION public.roboscore_score_points(text,integer,numeric,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.roboscore_score_points(text,integer,numeric,boolean) TO authenticated;
CREATE TABLE IF NOT EXISTS public.category_scoring (
 category_id uuid PRIMARY KEY,
 event_id uuid NOT NULL,
 rule text NOT NULL CHECK(rule IN ('EXCEL_2026','LEGACY_C','LEGACY_D')),
 challenge_count integer NOT NULL CHECK(challenge_count BETWEEN 1 AND 20),
 configured_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(event_id,category_id) REFERENCES public.event_categories(event_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS teams_scoring_identity ON public.teams(event_id,category_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS challenges_scoring_identity ON public.event_challenges(event_id,category_id,id);
CREATE TABLE IF NOT EXISTS public.team_scores (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL,category_id uuid NOT NULL,team_id uuid NOT NULL,challenge_id uuid NOT NULL,
 rule text NOT NULL CHECK(rule IN ('EXCEL_2026','LEGACY_C','LEGACY_D')),
 attempt integer NOT NULL CHECK(attempt>=0),
 seconds numeric(12,3) NOT NULL CHECK(seconds>=0 AND seconds<=999999999.999),
 completed boolean NOT NULL,
 points numeric GENERATED ALWAYS AS (public.roboscore_score_points(rule,attempt,seconds,completed)) STORED,
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=1000),
 recorded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(team_id,challenge_id),
 FOREIGN KEY(event_id,category_id,team_id) REFERENCES public.teams(event_id,category_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(event_id,category_id,challenge_id) REFERENCES public.event_challenges(event_id,category_id,id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS public.score_revisions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 score_id uuid NOT NULL REFERENCES public.team_scores(id) ON DELETE RESTRICT,
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
 changed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 old_data jsonb,new_data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scores_category_idx ON public.team_scores(category_id);
CREATE INDEX IF NOT EXISTS score_revisions_score_idx ON public.score_revisions(score_id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['teams','event_challenges','category_scoring','team_scores','score_revisions'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('DROP POLICY IF EXISTS scoring_admin_read ON public.%I',t);
  EXECUTE format('CREATE POLICY scoring_admin_read ON public.%I FOR SELECT TO authenticated USING (roboscore_private.can_manage_event(event_id))',t);
 END LOOP;
END $$;
REVOKE ALL ON public.category_scoring,public.team_scores,public.score_revisions FROM PUBLIC,anon;
REVOKE INSERT,UPDATE,DELETE ON public.category_scoring,public.team_scores,public.score_revisions FROM authenticated;

CREATE OR REPLACE FUNCTION public.roboscore_save_team(p_event uuid,p_id uuid,p_version timestamptz,p_category uuid,p_name text,p_institution text,p_robot text,p_active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events%ROWTYPE;c public.event_categories%ROWTYPE;t public.teams%ROWTYPE;
BEGIN
 IF NOT roboscore_private.can_manage_event(p_event) THEN RAISE EXCEPTION 'No tienes acceso a este evento.' USING ERRCODE='42501'; END IF;
 SELECT * INTO e FROM public.events WHERE id=p_event FOR UPDATE;
 IF e.status IN ('FINISHED','CANCELLED') THEN RAISE EXCEPTION 'El evento está cerrado. Reábrelo antes de modificar equipos.' USING ERRCODE='22023'; END IF;
 SELECT * INTO c FROM public.event_categories WHERE id=p_category AND event_id=p_event FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'La categoría no pertenece a este evento.' USING ERRCODE='22023'; END IF;
 IF p_id IS NULL OR p_active IS NULL OR coalesce(length(btrim(p_name)),0) NOT BETWEEN 1 AND 150 OR coalesce(length(btrim(p_institution)),0) NOT BETWEEN 1 AND 200 OR coalesce(length(p_robot),0)>150 THEN
  RAISE EXCEPTION 'Revisa nombre, institución y robot.' USING ERRCODE='22023'; END IF;
 SELECT * INTO t FROM public.teams WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  IF t.event_id<>p_event THEN RAISE EXCEPTION 'Equipo no disponible.' USING ERRCODE='42501'; END IF;
  IF p_version IS NULL THEN
   IF t.category_id=p_category AND t.name=btrim(p_name) AND t.institution=btrim(p_institution) AND coalesce(t.robot_name,'')=coalesce(btrim(p_robot),'') AND (t.status='ACTIVE')=p_active THEN RETURN t.id; END IF;
   RAISE EXCEPTION 'El equipo ya existe. Abre su ficha.' USING ERRCODE='40001';
  END IF;
  IF p_version IS DISTINCT FROM t.updated_at THEN RAISE EXCEPTION 'El equipo cambió. Recarga su ficha.' USING ERRCODE='40001'; END IF;
  IF t.category_id<>p_category AND EXISTS(SELECT 1 FROM public.team_scores WHERE team_id=p_id) THEN RAISE EXCEPTION 'Un equipo con puntuaciones conserva su categoría.' USING ERRCODE='22023'; END IF;
 ELSIF p_version IS NOT NULL THEN RAISE EXCEPTION 'Equipo no disponible.' USING ERRCODE='40001'; END IF;
 IF p_active AND c.status='CLOSED' THEN RAISE EXCEPTION 'La categoría está cerrada.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.teams WHERE event_id=p_event AND category_id=p_category AND id<>p_id AND lower(btrim(name))=lower(btrim(p_name))) THEN RAISE EXCEPTION 'Ya existe un equipo con ese nombre en la categoría.' USING ERRCODE='23505'; END IF;
 IF p_active AND (t.id IS NULL OR t.status='REJECTED' OR t.category_id<>p_category) THEN
  IF c.max_teams IS NOT NULL AND (SELECT count(*) FROM public.teams WHERE category_id=p_category AND id<>p_id AND status<>'REJECTED')>=c.max_teams THEN RAISE EXCEPTION 'La categoría alcanzó su máximo de equipos.' USING ERRCODE='22023'; END IF;
  IF e.max_teams IS NOT NULL AND (SELECT count(*) FROM public.teams WHERE event_id=p_event AND id<>p_id AND status<>'REJECTED')>=e.max_teams THEN RAISE EXCEPTION 'El evento alcanzó su máximo de equipos.' USING ERRCODE='22023'; END IF;
 END IF;
 IF t.id IS NULL THEN
  INSERT INTO public.teams(id,event_id,category_id,name,institution,robot_name,status) VALUES(p_id,p_event,p_category,btrim(p_name),btrim(p_institution),nullif(btrim(p_robot),''),CASE WHEN p_active THEN 'ACTIVE'::public.team_status ELSE 'REJECTED'::public.team_status END);
 ELSE
  UPDATE public.teams SET category_id=p_category,name=btrim(p_name),institution=btrim(p_institution),robot_name=nullif(btrim(p_robot),''),status=CASE WHEN p_active THEN 'ACTIVE'::public.team_status ELSE 'REJECTED'::public.team_status END WHERE id=p_id;
 END IF;
 RETURN p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.roboscore_configure_scoring(p_event uuid,p_category uuid,p_rule text,p_count integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events%ROWTYPE;c public.event_categories%ROWTYPE;i integer;
BEGIN
 IF NOT roboscore_private.can_manage_event(p_event) THEN RAISE EXCEPTION 'No tienes acceso a este evento.' USING ERRCODE='42501'; END IF;
 SELECT * INTO e FROM public.events WHERE id=p_event FOR UPDATE;
 SELECT * INTO c FROM public.event_categories WHERE id=p_category AND event_id=p_event FOR UPDATE;
 IF NOT FOUND OR c.status='CLOSED' OR e.status IN ('FINISHED','CANCELLED') THEN RAISE EXCEPTION 'El evento o la categoría no están disponibles para configurar.' USING ERRCODE='22023'; END IF;
 IF p_rule IS NULL OR p_rule NOT IN ('EXCEL_2026','LEGACY_C','LEGACY_D') OR p_count IS NULL OR p_count NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Selecciona una regla y entre 1 y 20 retos.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.team_scores WHERE category_id=p_category) THEN RAISE EXCEPTION 'La regla y los retos quedan fijos después de la primera puntuación.' USING ERRCODE='22023'; END IF;
 INSERT INTO public.category_scoring(category_id,event_id,rule,challenge_count,configured_by) VALUES(p_category,p_event,p_rule,p_count,auth.uid())
 ON CONFLICT(category_id) DO UPDATE SET rule=excluded.rule,challenge_count=excluded.challenge_count,configured_by=excluded.configured_by,updated_at=clock_timestamp();
 FOR i IN 1..p_count LOOP
  INSERT INTO public.event_challenges(event_id,category_id,name,sort_order) VALUES(p_event,p_category,'Reto '||i,i) ON CONFLICT(category_id,sort_order) DO NOTHING;
 END LOOP;
 UPDATE public.event_challenges SET active=(sort_order<=p_count) WHERE category_id=p_category;
 RETURN p_category;
END;
$$;

CREATE OR REPLACE FUNCTION public.roboscore_save_score(p_event uuid,p_team uuid,p_challenge uuid,p_version timestamptz,p_attempt integer,p_seconds numeric,p_completed boolean,p_notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events%ROWTYPE;t public.teams%ROWTYPE;c public.event_categories%ROWTYPE;r public.category_scoring%ROWTYPE;s public.team_scores%ROWTYPE;before_data jsonb;result_id uuid;
BEGIN
 IF NOT roboscore_private.can_manage_event(p_event) THEN RAISE EXCEPTION 'No tienes acceso para puntuar este evento.' USING ERRCODE='42501'; END IF;
 SELECT * INTO e FROM public.events WHERE id=p_event FOR UPDATE;
 SELECT * INTO t FROM public.teams WHERE id=p_team AND event_id=p_event FOR UPDATE;
 IF NOT FOUND OR t.status<>'ACTIVE' THEN RAISE EXCEPTION 'El equipo no participa en este evento.' USING ERRCODE='22023'; END IF;
 SELECT * INTO c FROM public.event_categories WHERE id=t.category_id FOR UPDATE;
 IF e.status<>'ACTIVE' OR c.status<>'ACTIVE' THEN RAISE EXCEPTION 'Activa el evento y la categoría antes de puntuar.' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM public.category_scoring WHERE category_id=c.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Configura primero la regla de puntuación.' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.event_challenges WHERE id=p_challenge AND event_id=p_event AND category_id=c.id AND active) THEN RAISE EXCEPTION 'El reto no corresponde al equipo.' USING ERRCODE='22023'; END IF;
 IF p_attempt IS NULL OR p_attempt<0 OR p_seconds IS NULL OR p_seconds<0 OR p_seconds>999999999.999 OR p_seconds<>round(p_seconds,3) OR p_completed IS NULL OR coalesce(length(p_notes),0)>1000 THEN RAISE EXCEPTION 'Revisa intento, segundos (hasta 3 decimales) y observaciones.' USING ERRCODE='22023'; END IF;
 SELECT * INTO s FROM public.team_scores WHERE team_id=p_team AND challenge_id=p_challenge FOR UPDATE;
 IF FOUND THEN
  IF p_version IS DISTINCT FROM s.updated_at THEN RAISE EXCEPTION 'La puntuación cambió. Recarga para evitar sobrescribirla.' USING ERRCODE='40001'; END IF;
  IF coalesce(length(btrim(p_notes)),0)=0 THEN RAISE EXCEPTION 'Explica el motivo de la corrección.' USING ERRCODE='22023'; END IF;
  before_data=to_jsonb(s);
  UPDATE public.team_scores SET attempt=p_attempt,seconds=p_seconds,completed=CASE WHEN r.rule='EXCEL_2026' THEN p_attempt>0 ELSE p_completed END,notes=btrim(p_notes),recorded_by=auth.uid(),updated_at=clock_timestamp() WHERE id=s.id RETURNING id INTO result_id;
 ELSE
  IF p_version IS NOT NULL THEN RAISE EXCEPTION 'La puntuación no existe. Recarga.' USING ERRCODE='40001'; END IF;
  INSERT INTO public.team_scores(event_id,category_id,team_id,challenge_id,rule,attempt,seconds,completed,notes,recorded_by) VALUES(p_event,c.id,p_team,p_challenge,r.rule,p_attempt,p_seconds,CASE WHEN r.rule='EXCEL_2026' THEN p_attempt>0 ELSE p_completed END,coalesce(btrim(p_notes),''),auth.uid()) RETURNING id INTO result_id;
 END IF;
 INSERT INTO public.score_revisions(score_id,event_id,changed_by,old_data,new_data) SELECT id,event_id,auth.uid(),before_data,to_jsonb(team_scores) FROM public.team_scores WHERE id=result_id;
 RETURN result_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.roboscore_scoring_board(p_event uuid,p_category uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE board jsonb;
BEGIN
 IF NOT roboscore_private.can_manage_event(p_event) THEN RAISE EXCEPTION 'No tienes acceso a este evento.' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.event_categories WHERE id=p_category AND event_id=p_event) THEN RAISE EXCEPTION 'Categoría no disponible.' USING ERRCODE='22023'; END IF;
 SELECT jsonb_build_object(
  'has_scores',EXISTS(SELECT 1 FROM public.team_scores WHERE category_id=p_category),
  'config',(SELECT to_jsonb(r) FROM public.category_scoring r WHERE category_id=p_category),
  'challenges',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'sort_order',sort_order) ORDER BY sort_order) FROM public.event_challenges WHERE category_id=p_category AND active),'[]'::jsonb),
  'teams',coalesce((SELECT jsonb_agg(to_jsonb(ranked) ORDER BY total DESC NULLS LAST,name,id) FROM (
   SELECT totals.*,CASE WHEN scored_count>0 THEN rank() OVER(ORDER BY total DESC NULLS LAST) ELSE NULL END AS position FROM (
    SELECT t.id,t.name,t.institution,count(s.id) AS scored_count,sum(s.points) AS total,
     coalesce(jsonb_agg(jsonb_build_object('id',s.id,'challenge_id',s.challenge_id,'attempt',s.attempt,'seconds',s.seconds,'completed',s.completed,'points',s.points,'notes',s.notes,'updated_at',s.updated_at)) FILTER(WHERE s.id IS NOT NULL),'[]'::jsonb) AS scores
    FROM public.teams t LEFT JOIN public.team_scores s ON s.team_id=t.id
    WHERE t.category_id=p_category AND t.status='ACTIVE' GROUP BY t.id
   ) totals
  ) ranked),'[]'::jsonb)) INTO board;
 RETURN board;
END;
$$;
REVOKE ALL ON FUNCTION public.roboscore_save_team(uuid,uuid,timestamptz,uuid,text,text,text,boolean),public.roboscore_configure_scoring(uuid,uuid,text,integer),public.roboscore_save_score(uuid,uuid,uuid,timestamptz,integer,numeric,boolean,text),public.roboscore_scoring_board(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roboscore_save_team(uuid,uuid,timestamptz,uuid,text,text,text,boolean),public.roboscore_configure_scoring(uuid,uuid,text,integer),public.roboscore_save_score(uuid,uuid,uuid,timestamptz,integer,numeric,boolean,text),public.roboscore_scoring_board(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

````

## supabase/verify-teams-scoring.sql

````sql
-- Solo lectura: ejecutar después de 202609210001_teams_scoring.sql.
WITH tables AS (
 SELECT c.oid,c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('teams','event_challenges','category_scoring','team_scores','score_revisions')
), functions AS (
 SELECT p.oid,p.prosecdef,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('roboscore_save_team','roboscore_configure_scoring','roboscore_save_score','roboscore_scoring_board')
)
SELECT '01. Cinco tablas con RLS' AS check_name,(SELECT count(*)=5 AND bool_and(relrowsecurity) FROM tables) AS passed
UNION ALL SELECT '02. Lectura autenticada y políticas por evento',
 (SELECT count(*)=5 AND bool_and(has_table_privilege('authenticated',oid,'SELECT')) FROM tables)
 AND (SELECT count(*)=5 FROM pg_policies WHERE schemaname='public' AND policyname='scoring_admin_read' AND cmd='SELECT')
UNION ALL SELECT '03. Sin escritura directa del cliente',
 (SELECT count(*)=5 AND bool_and(NOT has_table_privilege('authenticated',oid,'INSERT,UPDATE,DELETE')) FROM tables)
UNION ALL SELECT '04. Tablas sin acceso anónimo',
 (SELECT count(*)=5 AND bool_and(NOT has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE')) FROM tables)
UNION ALL SELECT '05. Cuatro funciones con permisos controlados',
 (SELECT count(*)=4 AND bool_and(prosecdef AND has_function_privilege('authenticated',oid,'EXECUTE') AND NOT has_function_privilege('anon',oid,'EXECUTE') AND array_to_string(proconfig,',') LIKE '%search_path=%') FROM functions)
UNION ALL SELECT '06. Puntos calculados por PostgreSQL',
 EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='team_scores' AND column_name='points' AND is_generated='ALWAYS')
UNION ALL SELECT '07. Equipo y reto vinculados a la misma categoría',
 (SELECT count(*)=2 FROM pg_constraint WHERE conrelid=to_regclass('public.team_scores') AND contype='f' AND array_length(conkey,1)=3)
UNION ALL SELECT '08. Fórmulas del Excel',
 public.roboscore_score_points('EXCEL_2026',1,8.275,true)=161.725
 AND public.roboscore_score_points('EXCEL_2026',0,0,true)=0
 AND public.roboscore_score_points('LEGACY_C',2,30,true)=60
 AND public.roboscore_score_points('LEGACY_D',2,30,true)=120
ORDER BY check_name;

````

## tests/scoring-validation.test.cjs

````cjs
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');
function load(file,deps={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>n in deps?deps[n]:require(n),Intl});return module.exports;}
const schema=load('lib/scoring/schema.ts');
// Exact reference inputs and cached outputs; no team or participant names copied.
const excel=[['CATA!H4',1,8.275,161.725],['CATA!H5',1,12.774,157.226],['CATA!H6',1,25.649,144.351],['CATB!H4',0,0,0],['CATC!H4',1,26.98,143.02],['CATC!H5',3,32.146,97.854],['CATC!H6',2,20.32,129.68],['CATD!H4',1,6.013,163.987],['CATD!H5',2,11.44,138.56]];
for(const [cell,attempt,seconds,expected] of excel)test('Excel reference '+cell,()=>assert.equal(schema.calculatePoints('EXCEL_2026',attempt,seconds,true),expected));
test('Zero, unsuccessful legacy and negative results stay distinct',()=>{assert.equal(schema.calculatePoints('EXCEL_2026',0,30,true),0);assert.equal(schema.calculatePoints('EXCEL_2026',4,140,true),-10);assert.equal(schema.calculatePoints('LEGACY_C',0,30,true),100);assert.equal(schema.calculatePoints('LEGACY_C',2,30,true),60);assert.equal(schema.calculatePoints('LEGACY_D',2,30,true),120);assert.equal(schema.calculatePoints('LEGACY_D',1,30,false),0);});
test('Comma decimals normalize; excess precision and missing values fail',()=>{const good={attempt:'1',seconds:'5,250',completed:'true',notes:''};assert.equal(schema.scoreSchema.parse(good).seconds,'5.250');for(const seconds of ['', '-1','NaN','1.0001','1e4'])assert(!schema.scoreSchema.safeParse({...good,seconds}).success);});
function scoreAction(denied=false){let calls=[];const action=load('app/admin/eventos/[id]/puntuaciones/actions.ts',{'../../../../../lib/scoring/schema':schema,'../../../../../lib/auth/authorization':{requireAccess:async()=>{if(denied)throw Error('DENIED');}},'../../../../../lib/supabase/server':{createClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:'ok',error:null};}})},'next/navigation':{redirect:()=>{throw Error('REDIRECT');}},'next/cache':{revalidatePath:()=>{}}});return {action,calls};}
const id='00000000-0000-4000-8000-000000000001';const form=(values)=>{const f=new FormData();for(const [k,v]of Object.entries(values))f.set(k,v);return f;};const good={attempt:'1',seconds:'5,250',completed:'true',notes:''};
test('Authorization runs before score write',async()=>{const f=scoreAction(true);await assert.rejects(f.action.saveScore(id,id,id,null,{},form(good)),/DENIED/);assert.equal(f.calls.length,0);});
test('A forged total or rule is never forwarded to the database',async()=>{const f=scoreAction();await assert.rejects(f.action.saveScore(id,id,id,null,{},form({...good,points:'99999',rule:'anything'})),/REDIRECT/);assert.equal(f.calls.length,1);assert.equal(f.calls[0].args.p_seconds,5.25);assert(!('points' in f.calls[0].args));assert(!('rule' in f.calls[0].args));});
test('Corrections need a reason; invalid seconds never reach RPC',async()=>{const f=scoreAction();assert((await f.action.saveScore(id,id,id,'2026-09-21T00:00:00Z',{},form(good))).errors.notes);assert((await f.action.saveScore(id,id,id,null,{},form({...good,seconds:''}))).errors.seconds);assert.equal(f.calls.length,0);});

````

## tests/teams-scoring-permissions.mjs

````mjs
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);const db=new PGlite();
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
GRANT USAGE ON SCHEMA public,auth TO authenticated;GRANT USAGE ON SCHEMA public TO anon;`);
for(const file of ['tests/fixtures/foundation.sql','supabase/migrations/202609160001_profiles_roles.sql','supabase/migrations/202609200002_event_management.sql','supabase/migrations/202609200003_category_management.sql','supabase/migrations/202609210001_teams_scoring.sql','supabase/migrations/202609210001_teams_scoring.sql'])await db.exec(await fs.readFile(new URL(file,root),'utf8'));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
for(let i=1;i<=5;i++){await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[id(i),`person${i}@example.test`,{}]);await db.query('UPDATE profiles SET role=$1,active=$2 WHERE id=$3',[i===1?'SUPER_ADMIN':i===4?'JUDGE':'ADMIN',i!==5,id(i)]);}
async function asUser(n,role='authenticated'){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);await db.exec('SET ROLE '+role);}
await db.query("INSERT INTO events(id,name,slug,start_date,end_date,created_by,status,max_teams) VALUES($1,'Evento A','evento-a',now(),now()+interval '1 day',$2,'ACTIVE',3),($3,'Evento B','evento-b',now(),now()+interval '1 day',$4,'ACTIVE',null)",[id(10),id(2),id(11),id(3)]);
await db.query("INSERT INTO event_categories(id,event_id,name,status,max_teams) VALUES($1,$2,'Categoría A','ACTIVE',2),($3,$2,'Categoría B','ACTIVE',null),($4,$5,'Categoría ajena','ACTIVE',null)",[id(20),id(10),id(21),id(22),id(11)]);
async function team(n=30,category=20,event=10,version=null,name='Equipo '+n,active=true){return db.query('SELECT roboscore_save_team($1,$2,$3,$4,$5,$6,$7,$8) AS id',[id(event),id(n),version,id(category),name,'Institución de prueba','Robot',active]);}
async function config(category=20,rule='EXCEL_2026',count=4,event=10){return db.query('SELECT roboscore_configure_scoring($1,$2,$3,$4)',[id(event),id(category),rule,count]);}
async function board(category=20,event=10){return (await db.query('SELECT roboscore_scoring_board($1,$2) AS board',[id(event),id(category)])).rows[0].board;}
async function version(table,n){return (await db.query(`SELECT updated_at::text AS v FROM ${table} WHERE id=$1`,[n])).rows[0].v;}
async function save(teamId,challenge,attempt,seconds,version=null,notes='',event=10,completed=true){return db.query('SELECT roboscore_save_score($1,$2,$3,$4,$5,$6,$7,$8) AS id',[id(event),id(teamId),challenge,version,attempt,seconds,completed,notes]);}
let checks=0;const pass=label=>{checks++;console.log('PASS '+label);};
await asUser(2);await team();await team();assert.equal((await db.query('SELECT id FROM teams')).rows.length,1);pass('Creation retries do not duplicate teams');
await assert.rejects(team(31,20,10,null,' equipo 30 '),{code:'23505'});await assert.rejects(team(31,22),{code:'22023'});pass('Duplicate names and categories from other events rejected');
await team(31);await assert.rejects(team(32),{code:'22023'});await team(32,21);await assert.rejects(team(33,21),{code:'22023'});pass('Category and event capacities enforced');
const oldTeamVersion=await version('teams',id(30));await team(30,20,10,oldTeamVersion,'Equipo actualizado');await assert.rejects(team(30,20,10,oldTeamVersion,'Overwrite'),{code:'40001'});pass('Stale team edit cannot overwrite');
await config();let b=await board();assert.equal(b.challenges.length,4);assert.equal(b.teams[0].total,null);assert.equal(b.teams[0].position,null);pass('Four challenges configured; missing scores are not zero');
const challenge=b.challenges[0].id;
await assert.rejects(save(30,challenge,1,'1.0001'),{code:'22023'});await assert.rejects(save(30,challenge,-1,5),{code:'22023'});await assert.rejects(save(30,challenge,1,-5),{code:'22023'});pass('Invalid attempt, negative time and excess precision rejected');
await save(30,challenge,1,'5.250');b=await board();assert.equal(Number(b.teams[0].total),164.75);assert.equal(b.teams[0].scored_count,1);assert.equal(b.has_scores,true);pass('Points use exact Excel base less seconds');
await assert.rejects(config(20,'LEGACY_C'),{code:'22023'});await assert.rejects(team(30,21,10,await version('teams',id(30))),{code:'22023'});pass('Rule and category cannot change after scoring');
await save(31,challenge,1,'5.250');b=await board();assert.deepEqual(b.teams.map(t=>t.position),[1,1]);pass('Equal totals share rank');
await assert.rejects(save(30,challenge,2,10),{code:'40001'});let score=(await db.query('SELECT id,updated_at::text AS v FROM team_scores WHERE team_id=$1',[id(30)])).rows[0];
await assert.rejects(save(30,challenge,2,10,score.v),{code:'22023'});await save(30,challenge,2,10,score.v,'Corrección del cronómetro');await assert.rejects(save(30,challenge,2,9,score.v,'Otra corrección'),{code:'40001'});
const revisions=(await db.query('SELECT old_data,new_data FROM score_revisions WHERE score_id=$1 ORDER BY id',[score.id])).rows;assert.equal(revisions.length,2);assert.equal(Number(revisions[1].old_data.points),164.75);assert.equal(Number(revisions[1].new_data.points),140);pass('Corrections require reason, preserve history and reject stale scores');
await team(30,20,10,await version('teams',id(30)),'Equipo retirado',false);b=await board();assert.equal(b.teams.length,1);assert.equal((await db.query('SELECT id FROM team_scores WHERE team_id=$1',[id(30)])).rows.length,1);await assert.rejects(save(30,b.challenges[1].id,1,10),{code:'22023'});pass('Withdrawal excludes ranking but preserves scores');
await team(30,20,10,await version('teams',id(30)),'Equipo retirado',true);
await config(21,'LEGACY_C',3);const otherChallenge=(await board(21)).challenges[0].id;await assert.rejects(save(30,otherChallenge,1,10),{code:'22023'});pass('Cannot score a challenge from another category');
for(const [rule,attempt,seconds,completed,expected] of [['EXCEL_2026',0,0,true,0],['EXCEL_2026',1,5.25,true,164.75],['EXCEL_2026',2,40,true,110],['EXCEL_2026',4,135,true,-5],['LEGACY_C',2,30,true,60],['LEGACY_C',0,30,true,100],['LEGACY_D',2,30,true,120],['LEGACY_D',1,10,false,0]]){const value=(await db.query('SELECT roboscore_score_points($1,$2,$3,$4) AS p',[rule,attempt,seconds,completed])).rows[0].p;assert.equal(Number(value),expected);}
pass('Modern and both legacy formulas match zero, negative and later-attempt cases');
await asUser(3);assert.equal((await db.query('SELECT id FROM teams')).rows.length,0);await assert.rejects(team(34),{code:'42501'});await assert.rejects(save(30,challenge,1,0),{code:'42501'});await assert.rejects(board(),{code:'42501'});pass('Foreign administrator cannot read, write or rank event');
for(const n of [4,5]){await asUser(n);await assert.rejects(team(34),{code:'42501'});await assert.rejects(config(),{code:'42501'});await assert.rejects(save(30,challenge,1,0),{code:'42501'});assert.equal((await db.query('SELECT id FROM team_scores')).rows.length,0);}pass('Unassigned judges and inactive users denied');
await asUser(0,'anon');await assert.rejects(board(),{code:'42501'});await assert.rejects(db.query('SELECT * FROM team_scores'),{code:'42501'});pass('Anonymous access denied');
await asUser(1);assert.equal((await board()).teams.length,2);await assert.rejects(db.query('UPDATE team_scores SET attempt=0'),{code:'42501'});await assert.rejects(db.query('DELETE FROM teams'),{code:'42501'});await assert.rejects(db.query('DELETE FROM score_revisions'),{code:'42501'});pass('Superadmin authorized through RPC; direct writes and deletion denied');
await db.query("UPDATE events SET status='FINISHED' WHERE id=$1",[id(10)]);await assert.rejects(save(30,b.challenges[1].id,1,10),{code:'22023'});await assert.rejects(team(34),{code:'22023'});pass('Finished event prevents score and team edits');
await db.exec('RESET ROLE');
const verification=await db.query(await fs.readFile(new URL('supabase/verify-teams-scoring.sql',root),'utf8'));
assert.equal(verification.rows.length,8);for(const check of verification.rows)assert.equal(check.passed,true,check.check_name);pass('Deployment verification reports eight passing checks');
await db.close();console.log(`${checks} PostgreSQL checks passed; no remote data changed.`);

````
