import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {eventContext} from '../../../../../../lib/scoring/read';
import {TeamForm} from '../team-form';
import {EventShell} from '../../../shell';
import {EventNavigation} from '../../../event-navigation';
import s from '../../../events.module.css';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params,{event,categories}=await eventContext(id);return <EventShell><header className={s.title}><p>{event.name}</p><h1>Nuevo equipo.</h1></header><EventNavigation eventId={id} current="teams"/>{categories.length?<TeamForm eventId={id} id={randomUUID()} categories={categories}/>:<div className={s.empty}><h2>Primero crea una categoría</h2><p>Cada equipo debe pertenecer a una categoría del evento.</p><Link className={s.primary} href={`/admin/eventos/${id}/categorias/nueva`}>Crear categoría</Link></div>}</EventShell>;}
