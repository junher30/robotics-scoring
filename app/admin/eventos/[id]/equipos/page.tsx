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
