import Link from 'next/link';
import {judgeData,type JudgeTeam} from '../../../../lib/judges/read';
import {ruleLabels} from '../../../../lib/scoring/schema';
import {JudgeShell} from '../../shell';
import {ScoreForm} from '../../../admin/eventos/[id]/puntuaciones/score-form';
import s from '../../../admin/eventos/events.module.css';
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{guardado?:string}>}){
 const data=await judgeData<JudgeTeam>('roboscore_judge_team',(await params).id);
 const locked=data.event_status!=='ACTIVE'||data.category_status!=='ACTIVE'||data.team.status!=='ACTIVE';
 return <JudgeShell><header className={s.title}><p>{data.event_name} · {data.category_name}</p><h1>{data.team.name}</h1><span>{data.team.institution}{data.rule?` · ${ruleLabels[data.rule]}`:''}</span></header><p><Link className={s.textLink} href={`/judge/categorias/${data.category_id}`}>← Volver a los equipos</Link></p>{(await searchParams).guardado==='1'&&<p className={s.success} role="status">Puntuación guardada. El resultado oficial y la clasificación ya están actualizados.</p>}{locked&&<p className={s.error}>La calificación está cerrada. El evento, la categoría y el equipo deben estar activos.</p>}{!data.rule?<section className={s.empty}><h2>Los retos aún no están configurados</h2><p>El organizador debe elegir la regla de puntuación antes de comenzar.</p></section>:<><section className={s.card}><h2>Cómo calificar</h2><p className={s.muted}>1. Registra el intento y el tiempo total en segundos. 2. Revisa los puntos previstos. 3. Guarda cada reto. Para cambiar un resultado ya guardado, explica el motivo; la corrección conserva el valor anterior.</p></section>{data.challenges.map(c=><ScoreForm key={`${c.id}-${data.scores.find(s=>s.challenge_id===c.id)?.updated_at??'new'}`} actor="judge" eventId={data.event_id} teamId={data.team.id} challenge={c} score={data.scores.find(s=>s.challenge_id===c.id)} rule={data.rule!} locked={locked}/>)}</>}</JudgeShell>;
}
