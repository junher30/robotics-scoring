import type {Metadata} from 'next';
import {randomUUID} from 'node:crypto';
import {requireAccess} from '../../../../lib/auth/authorization';
import {EventShell} from '../shell';
import {EventForm} from '../event-form';
import s from '../events.module.css';
export const metadata:Metadata={title:'Nuevo evento | RoboScore',robots:{index:false,follow:false}};
export default async function Page(){await requireAccess('admin');return <EventShell><header className={s.title}><p>UN NUEVO RETO</p><h1>Crea tu competencia.</h1><span>Organiza los detalles de tu próximo evento en un solo lugar.</span></header><EventForm id={randomUUID()}/></EventShell>}
