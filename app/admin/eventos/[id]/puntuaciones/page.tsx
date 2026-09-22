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
 {board&&category&&<><ConfigForm key={category.id} eventId={id} categoryId={category.id} config={board.config} hasScores={board.has_scores} hardLocked={category.status==='CLOSED'||['FINISHED','CANCELLED'].includes(event.status)}/>
 <h2 className={styles.heading}>Clasificación · {category.name}</h2><p className={s.muted}>La suma de los retos determina el total. Los empates comparten posición. “Parcial” indica que faltan retos; un equipo sin calificar aparece sin puntuación. Resultados actualizados al abrir o recargar esta página.</p>
 {teams.length?<div className={styles.tableWrap} role="region" aria-label="Clasificación de equipos" tabIndex={0}><table className={styles.table}><thead><tr><th>Pos.</th><th>Equipo</th><th>Retos</th><th>Total</th><th>Acción</th></tr></thead><tbody>{teams.map(t=><tr key={t.id}><td>{t.position??'—'}</td><td>{t.team_number!=null?`#${t.team_number} · `:''}{t.name}<small>{t.institution}</small></td><td>{t.scored_count}/{board.challenges.length}<small>{t.scored_count===0?'Sin calificar':t.scored_count<board.challenges.length?'Parcial':'Completo'}</small></td><td className={styles.points}>{t.total===null?'—':formatPoints(t.total)}</td><td><Link href={`${base}/${t.id}`}>Puntuar →</Link></td></tr>)}</tbody></table></div>:<div className={s.empty}><h2>No hay equipos en esta vista</h2><p>Añade equipos participantes o vuelve a la primera página.</p><Link className={s.primary} href={`/admin/eventos/${id}/equipos`}>Ver equipos</Link></div>}
 <nav className={s.pagination} aria-label="Páginas de clasificación">{page>1&&<Link className={s.secondary} href={`${base}?categoria=${category.id}&pagina=${page-1}`}>Anterior</Link>}{page*20<board.teams.length&&<Link className={s.secondary} href={`${base}?categoria=${category.id}&pagina=${page+1}`}>Siguiente</Link>}</nav></>}
 </EventShell>;
}
