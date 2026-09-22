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
 return <EventShell><header className={s.title}><p>{event.name} · {category.name}</p><h1>{team.team_number!=null?`#${team.team_number} · `:''}{team.name}</h1><span>{team.institution}{config?` · ${ruleLabels[config.rule]}`:''}</span></header><EventNavigation eventId={id} current="scores"/>{(await searchParams).guardado==='1'&&<p role="status" className={s.success}>Puntuación guardada. La clasificación ya refleja el cambio.</p>}
 <p className={s.muted}><Link href={`/admin/eventos/${id}/puntuaciones?categoria=${category.id}`}>← Volver a la clasificación</Link></p>
 {team.participant_names.length>0&&<section className={s.card}><h2>Participantes</h2><ul>{team.participant_names.map(name=><li key={name}>{name}</li>)}</ul></section>}
 {!config?<div className={s.empty}><h2>Configura los retos de esta categoría</h2><p>Selecciona la fórmula del Excel y el número de retos antes de puntuar.</p><Link className={s.primary} href={`/admin/eventos/${id}/puntuaciones?categoria=${category.id}`}>Configurar puntuación</Link></div>:<>{locked&&<p className={s.error} role="status">Para guardar puntuaciones, el evento y la categoría deben estar activos y el equipo debe participar.</p>}{challenges.map(challenge=><ScoreForm key={`${challenge.id}-${scores.find(score=>score.challenge_id===challenge.id)?.updated_at??'new'}`} eventId={id} teamId={team.id} challenge={challenge} score={scores.find(score=>score.challenge_id===challenge.id)} rule={config.rule} locked={locked}/>)}</>}
 {historyFailed?<p role="alert" className={s.error}>No pudimos consultar el historial de cambios.</p>:history.length>0&&<section className={s.card}><h2>Últimos cambios</h2><p className={s.muted}>Hasta 10 registros recientes. Las correcciones conservan el valor anterior.</p><ol className={styles.history}>{history.map(h=><li key={h.id}><time dateTime={h.created_at}>{new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',dateStyle:'short',timeStyle:'short'}).format(new Date(h.created_at))}</time> · {h.old_data?`${formatPoints(h.old_data.points)} → `:''}{formatPoints(h.new_data.points)} puntos{h.new_data.notes?` · ${h.new_data.notes}`:''}</li>)}</ol></section>}
 </EventShell>;
}
