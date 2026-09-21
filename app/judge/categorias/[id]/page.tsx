import Link from 'next/link';
import {judgeData,type JudgeCategory} from '../../../../lib/judges/read';
import {formatPoints} from '../../../../lib/scoring/schema';
import {JudgeShell} from '../../shell';
import s from '../../../admin/eventos/events.module.css';
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{q?:string;pagina?:string}>}){
 const {id}=await params,data=await judgeData<JudgeCategory>('roboscore_judge_category',id),query=await searchParams;
 const q=(query.q??'').trim().slice(0,200);const norm=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const teams=data.teams.filter(t=>norm(`${t.name} ${t.institution} ${t.robot_name??''}`).includes(norm(q)));
 const pages=Math.max(1,Math.ceil(teams.length/20));const page=Math.min(pages,/^[1-9]\d{0,5}$/.test(query.pagina??'')?Number(query.pagina):1);
 const url=(p:number)=>`?${new URLSearchParams({q,pagina:String(p)})}`;
 return <JudgeShell><header className={s.title}><p>{data.event_name}</p><h1>{data.category_name}</h1><span>Los puntos se guardan por equipo y reto. Si otro juez ya calificó, verás su resultado oficial.</span></header><p><Link className={s.textLink} href="/judge">← Mis categorías</Link></p><form className={s.filters}><label htmlFor="q">Buscar equipo</label><input id="q" name="q" defaultValue={q} placeholder="Nombre, institución o robot" maxLength={200} style={{padding:12,border:'1px solid #dce2ea',borderRadius:8,maxWidth:'100%'}}/><button className={s.secondary}>Buscar</button><Link href={`/judge/categorias/${id}`}>Limpiar</Link></form><p className={s.muted}>{teams.length} equipos · Página {page} de {pages}</p><div className={s.list}>{teams.slice((page-1)*20,page*20).map(t=><article className={s.event} key={t.id}><div><h2>{t.name}</h2><p>{t.institution}{t.robot_name?` · ${t.robot_name}`:''}</p><p>{t.scored_count} de {data.challenge_count??'—'} retos · <strong>{t.total===null?'Sin calificar':`${formatPoints(t.total)} puntos`}</strong></p></div><Link className={s.primary} href={`/judge/equipos/${t.id}`}>Calificar →</Link></article>)}</div>{!teams.length&&<section className={s.empty}><h2>No hay equipos en esta vista</h2><p>Prueba otra búsqueda o consulta al organizador.</p></section>}<nav className={s.pagination} aria-label="Páginas de equipos">{page>1&&<Link className={s.secondary} href={url(page-1)}>Anterior</Link>}{page<pages&&<Link className={s.secondary} href={url(page+1)}>Siguiente</Link>}</nav></JudgeShell>;
}
