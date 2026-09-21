import type {Metadata} from 'next';
import {z} from 'zod';
import {notFound} from 'next/navigation';
import Link from 'next/link';
import {requireAccess} from '../../../../lib/auth/authorization';
import {readEvent} from '../../../../lib/events/read';
import {recordValues} from '../../../../lib/events/schema';
import {EventShell} from '../shell';
import {EventForm} from '../event-form';
import {EventNavigation} from '../event-navigation';
import s from '../events.module.css';
export const metadata:Metadata={title:'Editar evento | RoboScore',robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{resultado?:string}>}){
 await requireAccess('admin');const {id}=await params;if(!z.string().uuid().safeParse(id).success)notFound();
 const {data,error}=await readEvent(id);const query=await searchParams;
 if(error)return <EventShell><div role="alert" className={s.error}>No pudimos cargar el evento. Comprueba la conexión y que el SQL de la fase 9 esté instalado.</div><Link href={`/admin/eventos/${id}`} className={s.secondary}>Reintentar</Link></EventShell>;
 if(!data)notFound();
 return <EventShell><header className={s.title}><p>DETALLES DE TU COMPETENCIA</p><h1>{data.name}</h1><span>Edita la información o cambia el estado. Los cambios se aplican al guardar.</span></header><EventNavigation eventId={id} current="info"/>{['creado','guardado'].includes(query.resultado??'')&&<p role="status" className={s.success}>{query.resultado==='creado'?'Evento creado correctamente.':'Cambios guardados.'}</p>}<EventForm key={data.updated_at} id={id} version={data.updated_at} initial={recordValues(data)}/></EventShell>;
}
