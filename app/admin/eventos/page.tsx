import type {Metadata} from 'next';
import Link from 'next/link';
import {requireAccess} from '../../../lib/auth/authorization';
import {createClient} from '../../../lib/supabase/server';
import {statusLabels,statuses,type EventRecord} from '../../../lib/events/schema';
import {eventColumns} from '../../../lib/events/read';
import {EventShell} from './shell';
import s from './events.module.css';
export const metadata:Metadata={title:'Eventos | RoboScore',robots:{index:false,follow:false}};
const formatDate=new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeZone:'America/Bogota'});
export default async function Page({searchParams}:{searchParams:Promise<{estado?:string;pagina?:string}>}){
 const profile=await requireAccess('admin');const params=await searchParams;
 const status=statuses.find(item=>item===params.estado);const page=/^[1-9]\d{0,5}$/.test(params.pagina??'')?Number(params.pagina):1;
 let rows:EventRecord[]=[];let failed=false;let count=0;
 try{const client=await createClient();let query=client.from('events').select(eventColumns,{count:'exact'}).order('start_date',{ascending:false}).order('id').range((page-1)*20,page*20-1);if(status)query=status==='DRAFT'?query.in('status',['DRAFT','REGISTRATION']):query.eq('status',status);const result=await query.returns<EventRecord[]>();failed=Boolean(result.error);rows=result.data??[];count=result.count??0;}catch{failed=true;}
 const href=(p:number)=>`/admin/eventos?${new URLSearchParams({...(status?{estado:status}:{}),pagina:String(p)})}`;
 return <EventShell><header className={s.titleRow}><div className={s.title}><p>TUS COMPETENCIAS</p><h1>Eventos.</h1><span>{profile.role==='SUPER_ADMIN'?'Gestiona todos los eventos de RoboScore.':'Gestiona los eventos que has creado.'}</span></div><Link href="/admin/eventos/nuevo" className={s.primary}>+ Nuevo evento</Link></header>
 <form method="get" className={s.filters}><label htmlFor="estado">Estado</label><select id="estado" name="estado" defaultValue={status??''}><option value="">Todos</option>{statuses.map(item=><option key={item} value={item}>{statusLabels[item]}</option>)}</select><button className={s.secondary}>Filtrar</button><Link href="/admin/eventos" className={s.textLink}>Limpiar</Link></form>
 {failed?<div role="alert" className={s.error}>No pudimos consultar los eventos. Comprueba la conexión y ejecuta el SQL de la fase 9 si aún no lo has instalado. <Link href={href(page)}>Reintentar</Link></div>:<><p className={s.muted}>{count} {count===1?'evento':'eventos'} · Página {page}</p>{rows.length===0?<section className={s.empty}><span aria-hidden="true">◈</span><h2>{status||page>1?'No hay eventos en esta vista':'Tu primera competencia empieza aquí'}</h2><p>{status||page>1?'Prueba otro estado o vuelve a la primera página.':'Crea un evento y prepara el siguiente gran reto de tu comunidad.'}</p><Link href={status||page>1?'/admin/eventos':'/admin/eventos/nuevo'} className={s.primary}>{status||page>1?'Ver todos los eventos':'Crear mi primer evento'}</Link></section>:<div className={s.list}>{rows.map(event=><article key={event.id} className={s.event}><div><span className={s.badge}>{statusLabels[event.status]}</span><h2><Link href={`/admin/eventos/${event.id}`}>{event.name}</Link></h2><p>{event.city||event.location||'Lugar por definir'} · <time dateTime={event.start_date}>{formatDate.format(new Date(event.start_date))}</time></p></div><Link href={`/admin/eventos/${event.id}`} className={s.secondary}>Editar evento →</Link></article>)}</div>}<nav className={s.pagination} aria-label="Páginas de eventos">{page>1&&<Link href={href(page-1)} className={s.secondary}>← Anterior</Link>}{page*20<count&&<Link href={href(page+1)} className={s.secondary}>Siguiente →</Link>}</nav></>}
 </EventShell>;
}
