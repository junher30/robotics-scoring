import {eventContext,readTeam} from '../../../../../../lib/scoring/read';
import {TeamForm} from '../team-form';
import {EventShell} from '../../../shell';
import {EventNavigation} from '../../../event-navigation';
import s from '../../../events.module.css';
export default async function Page({params,searchParams}:{params:Promise<{id:string;teamId:string}>;searchParams:Promise<{guardado?:string}>}){const {id,teamId}=await params,{event,categories}=await eventContext(id),team=await readTeam(id,teamId);return <EventShell><header className={s.title}><p>{event.name}</p><h1>{team.name}</h1></header><EventNavigation eventId={id} current="teams"/>{(await searchParams).guardado==='1'&&<p role="status" className={s.success}>Equipo guardado.</p>}<TeamForm eventId={id} id={teamId} categories={categories} team={team}/></EventShell>;}
