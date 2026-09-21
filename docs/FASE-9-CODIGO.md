# Código completo — fase 9

## app/admin/eventos/[id]/not-found.tsx

```tsx
import Link from 'next/link';
import {EventShell} from '../shell';
import s from '../events.module.css';
export default function NotFound(){return <EventShell><section className={s.card}><h1>Evento no disponible</h1><p>No existe o tu cuenta no tiene acceso.</p><Link href="/admin/eventos" className={s.secondary}>Volver a eventos</Link></section></EventShell>}

```

## app/admin/eventos/[id]/page.tsx

```tsx
import type {Metadata} from 'next';
import {z} from 'zod';
import {notFound} from 'next/navigation';
import Link from 'next/link';
import {requireAccess} from '../../../../lib/auth/authorization';
import {readEvent} from '../../../../lib/events/read';
import {recordValues} from '../../../../lib/events/schema';
import {EventShell} from '../shell';
import {EventForm} from '../event-form';
import s from '../events.module.css';
export const metadata:Metadata={title:'Editar evento | RoboScore',robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{resultado?:string}>}){
 await requireAccess('admin');const {id}=await params;if(!z.string().uuid().safeParse(id).success)notFound();
 const {data,error}=await readEvent(id);const query=await searchParams;
 if(error)return <EventShell><div role="alert" className={s.error}>No pudimos cargar el evento. Comprueba la conexión y que el SQL de la fase 9 esté instalado.</div><Link href={`/admin/eventos/${id}`} className={s.secondary}>Reintentar</Link></EventShell>;
 if(!data)notFound();
 return <EventShell><header className={s.title}><p>DETALLES DE TU COMPETENCIA</p><h1>{data.name}</h1><span>Edita la información o cambia el estado. Los cambios se aplican al guardar.</span></header>{['creado','guardado'].includes(query.resultado??'')&&<p role="status" className={s.success}>{query.resultado==='creado'?'Evento creado correctamente.':'Cambios guardados.'}</p>}<EventForm key={data.updated_at} id={id} version={data.updated_at} initial={recordValues(data)}/></EventShell>;
}

```

## app/admin/eventos/actions.ts

```tsx
'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAccess } from '../../../lib/auth/authorization';
import { createClient } from '../../../lib/supabase/server';
import { eventSchema, emptyValues, toPayload, type EventState, type EventValues } from '../../../lib/events/schema';
export async function saveEvent(id:string, version:string|null, _previous:EventState, form:FormData):Promise<EventState> {
  const profile=await requireAccess('admin');
  const values=Object.fromEntries(Object.keys(emptyValues).map(key=>[key,key==='public'?form.get(key)==='on':String(form.get(key)??'')])) as EventValues;
  const parsed=eventSchema.safeParse(values);
  if(!parsed.success)return {values,errors:parsed.error.flatten().fieldErrors,message:'Revisa los campos indicados.'};
  if(!z.string().uuid().safeParse(id).success || (version!==null&&!z.string().datetime({offset:true}).safeParse(version).success)) return {values,message:'La referencia del evento no es válida. Abre el formulario de nuevo.'};
  try {
    const client=await createClient(); const payload=toPayload(parsed.data);
    if(version===null){
      const base=parsed.data.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80).replace(/-$/,'') || 'evento';
      const {error}=await client.from('events').insert({...payload,id,slug:`${base}-${id}`,created_by:profile.id});
      if(error){
        // A retry of this form reuses its UUID; it never inserts a second event.
        if(error.code==='23505'){
          const existing=await client.from('events').select('id').eq('id',id).eq('created_by',profile.id).maybeSingle();
          if(existing.error||!existing.data)return {values,message:'No se pudo crear el evento. Abre el formulario de nuevo.'};
        }else return {values,message:error.code==='42501'?'No pudimos guardar: comprueba tus permisos y la instalación del SQL de la fase 9.':'No se pudo crear el evento. Revisa los datos e inténtalo de nuevo.'};
      }
    }else{
      const {data,error}=await client.from('events').update(payload).eq('id',id).eq('updated_at',version).select('id').maybeSingle();
      if(error)return {values,message:error.code==='42501'?'No tienes permiso para guardar este evento o falta activar la fase 9.':'No se pudieron guardar los cambios. Inténtalo de nuevo.'};
      if(!data)return {values,message:'El evento cambió en otra sesión o ya no tienes acceso. Recarga la página antes de editar; conserva una copia de tus cambios si la necesitas.'};
    }
  } catch{return {values,message:'No se pudo confirmar la operación. Comprueba tu conexión y reintenta con este mismo formulario.'};}
  revalidatePath('/admin'); revalidatePath('/admin/eventos');revalidatePath(`/admin/eventos/${id}`);
  redirect(`/admin/eventos/${id}?resultado=${version===null?'creado':'guardado'}`);
}

```

## app/admin/eventos/event-form.tsx

```tsx
'use client';
import {useActionState,useEffect,useRef} from 'react';
import Link from 'next/link';
import {saveEvent} from './actions';
import {emptyValues,statusLabels,statuses,type EventValues,type EventState} from '../../../lib/events/schema';
import s from './events.module.css';
export function EventForm({id,version=null,initial=emptyValues}:{id:string;version?:string|null;initial?:EventValues}){
 const [state,action,pending]=useActionState<EventState,FormData>(saveEvent.bind(null,id,version),{});
 const notice=useRef<HTMLDivElement>(null);useEffect(()=>{if(state.message)notice.current?.focus();},[state]);
 const values=state.values??initial;
 function input(key:Exclude<keyof EventValues,'public'|'status'>,label:string,type='text',required=false,maxLength?:number){return <div className={s.field}><label htmlFor={key}>{label}{required?' *':''}</label><input id={key} name={key} type={type} required={required} maxLength={maxLength} min={type==='number'?1:undefined} step={type==='number'?1:undefined} defaultValue={values[key]} aria-invalid={Boolean(state.errors?.[key])} aria-describedby={state.errors?.[key]?`${key}-error`:undefined}/>{state.errors?.[key]&&<p className={s.fieldError} id={`${key}-error`}>{state.errors[key]?.[0]}</p>}</div>}
 return <form action={action} noValidate aria-busy={pending}>
  {state.message&&<div ref={notice} tabIndex={-1} role="alert" className={s.error}>{state.message}</div>}
  <fieldset disabled={pending} className={s.formFields}><section className={s.card}><h2>01 · Información del evento</h2><p className={s.muted}>Los campos con * son obligatorios.</p>{input('name','Nombre del evento','text',true,150)}<div className={s.field}><label htmlFor="description">Descripción</label><textarea id="description" name="description" rows={4} maxLength={5000} defaultValue={values.description} aria-invalid={Boolean(state.errors?.description)} aria-describedby={state.errors?.description?'description-error':undefined}/>{state.errors?.description&&<p id="description-error" className={s.fieldError}>{state.errors.description[0]}</p>}</div>{input('organizer_name','Organizador','text',false,200)}</section>
  <section className={s.card}><h2>02 · Fechas del evento</h2><p className={s.muted}>Hora de Colombia (UTC−5). Define cuándo empieza y termina la competencia.</p><div className={s.grid}>{input('start_date','Inicio del evento','datetime-local',true)}{input('end_date','Fin del evento','datetime-local',true)}</div></section>
  <section className={s.card}><h2>03 · Lugar y capacidad</h2><div className={s.grid}>{input('location','Lugar','text',false,200)}{input('city','Ciudad','text',false,150)}{input('address','Dirección','text',false,300)}{input('max_teams','Máximo de equipos','number')}</div><p className={s.muted}>Déjalo vacío si aún no has definido una capacidad.</p></section>
  <section className={s.card}><h2>04 · Estado y recursos</h2><div className={s.field}><label htmlFor="status">Estado *</label><select id="status" name="status" defaultValue={values.status} aria-invalid={Boolean(state.errors?.status)} aria-describedby="status-help">{statuses.map(status=><option key={status} value={status}>{statusLabels[status]}</option>)}</select><p id="status-help" className={s.muted}>Para retirar un evento, elige Cancelado y guarda. Su información se conserva; puedes reactivarlo cambiando el estado.</p>{state.errors?.status&&<p className={s.fieldError}>{state.errors.status[0]}</p>}</div><label className={s.checkbox}><input type="checkbox" name="public" defaultChecked={values.public}/> Marcar como evento público</label><p className={s.muted}>Guarda tu intención de publicación. La ficha pública se habilitará en una fase posterior.</p><div className={s.grid}>{input('logo_url','Enlace al logo (opcional)','url',false,2000)}{input('rules_url','Enlace al reglamento (opcional)','url',false,2000)}</div><p className={s.muted}>Usa enlaces http:// o https:// a archivos ya alojados. No se suben archivos en esta fase.</p></section>
  <div className={s.actions}><Link href="/admin/eventos" className={s.secondary}>Volver al listado</Link><button className={s.primary} type="submit" disabled={pending}>{pending?'Guardando…':version?'Guardar cambios':'Crear evento'}</button></div>
  </fieldset>
 </form>;
}

```

## app/admin/eventos/events.module.css

```css
.screen{min-height:100svh;background:#f7f8fa;color:#1e293b;font-family:Arial,Helvetica,sans-serif}.header{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:24px max(24px,calc((100vw - 1100px)/2));background:#fff;border-bottom:1px solid #e5e9ee}.brand{display:flex;align-items:center;gap:10px;font-size:24px;font-weight:800;color:#1e293b;text-decoration:none;letter-spacing:-1px}.brand span{width:34px;height:34px;display:grid;place-items:center;background:#dc303c;color:white;border-radius:10px;transform:rotate(-5deg)}.header nav{display:flex;gap:22px;font-size:14px}.header nav a{color:#627087;text-decoration:none;padding:7px 0}.header nav a[aria-current]{color:#c62c38;border-bottom:2px solid #dc303c}.main{max-width:1100px;padding:40px 24px;margin:auto}.title{margin-bottom:30px}.title>p{font-size:11px;letter-spacing:1.7px;color:#aa5056;font-weight:700;margin:0 0 12px}.title h1{font-size:clamp(28px,4vw,42px);letter-spacing:-1.3px;line-height:1.2;font-weight:750;margin:0 0 12px;overflow-wrap:anywhere}.title span{font-size:14px;color:#718096;line-height:1.8}.titleRow{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-bottom:10px}.primary,.secondary{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:11px 18px;border-radius:10px;font-size:14px;font-weight:650;text-decoration:none;line-height:1.4;cursor:pointer}.primary{background:#d92e3a;color:#fff;border:1px solid #d92e3a}.primary:hover{background:#b72531}.secondary{background:#fff;color:#4b596e;border:1px solid #dce1e8}.secondary:hover{background:#f2f4f7}.primary:disabled{opacity:.65;cursor:wait}.titleRow>.primary{flex-shrink:0}.card{padding:28px;background:white;border:1px solid #e4e8ef;border-radius:15px;margin-bottom:22px}.card h2{font-size:18px;font-weight:700;letter-spacing:-.4px;margin:0 0 18px}.muted{font-size:13px;line-height:1.8;color:#738095;margin:8px 0 18px}.formFields{border:0;margin:0;padding:0;min-width:0}.field{display:flex;flex-direction:column;gap:9px;margin:18px 0;min-width:0}.field label{font-size:13px;font-weight:650}.field input,.field select,.field textarea,.filters select{width:100%;min-width:0;min-height:46px;padding:12px;border:1px solid #d8dfe8;border-radius:9px;font:inherit;font-size:15px;background:#fff;color:#1e293b}.field textarea{resize:vertical;min-height:100px}.field input[aria-invalid=true],.field textarea[aria-invalid=true]{border-color:#bf3440}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px}.checkbox{display:flex;align-items:center;gap:10px;font-size:14px;margin:20px 0 10px}.checkbox input{width:18px;height:18px;accent-color:#d92e3a}.fieldError{color:#b12734;font-size:12px;line-height:1.6;margin:0}.error,.success{padding:17px 20px;border-radius:10px;font-size:14px;line-height:1.8;margin-bottom:25px}.error{background:#fff0ef;border:1px solid #efc7c5;color:#9d2d32}.success{background:#edf8f1;color:#2e654b;border:1px solid #cae9d5}.actions{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:8px 0 24px}.filters{display:flex;align-items:center;gap:13px;padding:18px 20px;background:white;border:1px solid #e4e8ef;border-radius:12px;margin:5px 0 22px;flex-wrap:wrap}.filters label{font-size:13px;font-weight:650}.filters select{width:200px}.textLink{font-size:13px;color:#7a5660}.empty{text-align:center;padding:55px 22px;background:#fff;border:1px solid #e4e8ef;border-radius:16px}.empty>span{display:block;color:#c36961;font-size:40px;margin-bottom:16px}.empty h2{font-size:24px;letter-spacing:-.5px;font-weight:700;margin:0 0 14px}.empty p{font-size:14px;color:#718096;line-height:1.8;margin:0 auto 25px;max-width:420px}.list{display:grid;gap:14px}.event{background:#fff;border:1px solid #e4e8ef;border-radius:13px;padding:23px;display:flex;align-items:center;justify-content:space-between;gap:25px}.event>div{min-width:0}.event h2{font-size:20px;line-height:1.5;font-weight:700;overflow-wrap:anywhere;margin:12px 0 8px}.event h2 a{text-decoration:none;color:#233147}.event p{font-size:13px;line-height:1.7;color:#718096;margin:0}.event>.secondary{flex-shrink:0}.badge{font-size:11px;border-radius:20px;padding:5px 9px;background:#fff0eb;color:#a5554b}.pagination{display:flex;justify-content:flex-end;gap:12px;margin-top:22px}.footer{font-size:12px;color:#929ba8;text-align:center;padding:22px}.screen a:focus-visible,.screen input:focus-visible,.screen button:focus-visible,.screen select:focus-visible,.screen textarea:focus-visible{outline:3px solid #c52f3c;outline-offset:3px}@media(max-width:650px){.header{padding:20px;align-items:flex-start;flex-direction:column;gap:15px}.header nav{gap:25px}.main{padding:28px 18px}.grid{grid-template-columns:1fr;gap:0}.card{padding:22px 18px}.titleRow{align-items:flex-start;flex-direction:column;gap:0;margin-bottom:25px}.field input,.field select,.field textarea{font-size:16px}.event{align-items:flex-start;flex-direction:column;gap:18px}.event>.secondary{width:100%}.actions{gap:10px;flex-wrap:wrap}.filters{padding:15px;gap:10px}.filters select{flex:1;min-width:130px}.primary,.secondary{font-size:13px}.titleRow>.primary{width:100%}}

```

## app/admin/eventos/nuevo/page.tsx

```tsx
import type {Metadata} from 'next';
import {randomUUID} from 'node:crypto';
import {requireAccess} from '../../../../lib/auth/authorization';
import {EventShell} from '../shell';
import {EventForm} from '../event-form';
import s from '../events.module.css';
export const metadata:Metadata={title:'Nuevo evento | RoboScore',robots:{index:false,follow:false}};
export default async function Page(){await requireAccess('admin');return <EventShell><header className={s.title}><p>UN NUEVO RETO</p><h1>Crea tu competencia.</h1><span>Organiza los detalles de tu próximo evento en un solo lugar.</span></header><EventForm id={randomUUID()}/></EventShell>}

```

## app/admin/eventos/page.tsx

```tsx
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

```

## app/admin/eventos/shell.tsx

```tsx
import Link from 'next/link';
import type {ReactNode} from 'react';
import s from './events.module.css';
export function EventShell({children}:{children:ReactNode}){return <div className={s.screen}><header className={s.header}><Link href="/admin" className={s.brand}><span>R</span>RoboScore.</Link><nav aria-label="Administración"><Link href="/admin">Resumen</Link><Link href="/admin/eventos" aria-current="page">Eventos</Link><Link href="/cuenta">Mi cuenta</Link></nav></header><main className={s.main}>{children}</main><footer className={s.footer}>RoboScore · Crear. Aprender. Competir.</footer></div>}

```

## lib/events/read.ts

```tsx
import 'server-only';
import { requireAccess } from '../auth/authorization';
import { createClient } from '../supabase/server';
import type { EventRecord } from './schema';
export const eventColumns = 'id,slug,name,description,start_date,end_date,location,city,address,organizer_name,max_teams,status,public,logo_url,rules_url,created_by,updated_at';
export async function readEvent(id:string) {
  await requireAccess('admin');
  try {const client=await createClient();const {data,error}=await client.from('events').select(eventColumns).eq('id',id).maybeSingle<EventRecord>();return {data,error:Boolean(error)};}
  catch{return {data:null,error:true};}
}

```

## lib/events/schema.ts

```tsx
import { z } from 'zod';
export const statuses = ['DRAFT','ACTIVE','FINISHED','CANCELLED'] as const;
// Compatibilidad de lectura con eventos antiguos; el formulario solo guarda los cuatro estados actuales.
export const statusLabels: Record<typeof statuses[number] | 'REGISTRATION', string> = {DRAFT:'Borrador',REGISTRATION:'Borrador',ACTIVE:'Activo',FINISHED:'Finalizado',CANCELLED:'Cancelado'};
const text = (max: number) => z.string().trim().max(max, `Usa como máximo ${max} caracteres.`);
const localDate = z.string().refine(value => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const parsed = new Date(value + ':00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,16) === value && Number(value.slice(0,4)) >= 2000;
}, 'Escribe una fecha y hora válidas (año 2000 o posterior).');
const url = text(2000).refine(value => { if (!value) return true; try { const u = new URL(value); return ['http:','https:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; } }, 'Usa una URL completa http:// o https:// sin credenciales.');
export const eventSchema = z.object({
  name:text(150).min(1,'El nombre del evento es obligatorio.'), description:text(5000),
  start_date:localDate, end_date:localDate,
  location:text(200), city:text(150), address:text(300), organizer_name:text(200),
  max_teams:z.string().trim().refine(v=>v==='' || (/^[1-9]\d*$/.test(v) && Number(v)<=2147483647),'Escribe un número entero positivo (máximo 2147483647).'),
  status:z.enum(statuses), public:z.boolean(), logo_url:url, rules_url:url,
}).superRefine((v,c)=>{
  const issue=(path:string,message:string)=>c.addIssue({code:'custom',path:[path],message});
  if(v.end_date<v.start_date) issue('end_date','La fecha final no puede ser anterior a la inicial.');
});
export type EventValues = z.infer<typeof eventSchema>;
export type EventState = {message?:string; errors?:Partial<Record<keyof EventValues,string[]>>; values?:EventValues};
type NullableField = 'description'|'location'|'city'|'address'|'organizer_name'|'logo_url'|'rules_url';
export type EventRecord = Omit<EventValues,'max_teams'|'status'|NullableField> & {[K in NullableField]:string|null} & {status:EventValues['status']|'REGISTRATION';id:string;slug:string;created_by:string;updated_at:string;max_teams:number|null};
export const emptyValues: EventValues = {name:'',description:'',start_date:'',end_date:'',location:'',city:'',address:'',organizer_name:'',max_teams:'',status:'DRAFT',public:false,logo_url:'',rules_url:''};
export function toLocalDate(value:string|null|undefined) { return value ? new Date(new Date(value).getTime()-5*60*60*1000).toISOString().slice(0,16) : ''; }
// Desactiva las fechas antiguas al guardar para que no restrinjan la duración del evento.
export function toPayload(v:EventValues) {return {...v, start_date:new Date(v.start_date+':00-05:00').toISOString(), end_date:new Date(v.end_date+':00-05:00').toISOString(),registration_start:null,registration_end:null,max_teams:v.max_teams?Number(v.max_teams):null};}
export function recordValues(event:EventRecord):EventValues {const values={...emptyValues}; for(const key of Object.keys(values) as (keyof EventValues)[]) { if(key==='public') values.public=event.public; else if(key==='status') values.status=event.status==='REGISTRATION'?'DRAFT':event.status; else if(key==='max_teams') values.max_teams=event.max_teams?.toString()??''; else if(['start_date','end_date'].includes(key)) values[key]=toLocalDate(event[key]); else values[key]=event[key]??''; } return values;}

```

## lib/dashboard/schema.ts

```tsx
import { z } from 'zod';
const count = z.number().int().nonnegative();
export const dashboardSchema = z.object({
  events: count, active_events: count, upcoming_events: count,
  teams: count, participants: count, judges: count,
  next_events: z.array(z.object({
    id: z.string().uuid(), name: z.string(), status: z.enum(['DRAFT', 'REGISTRATION', 'ACTIVE']).transform(value => value === 'REGISTRATION' ? 'DRAFT' : value),
    start_date: z.string().datetime({ offset: true }), end_date: z.string().datetime({ offset: true }),
    city: z.string().nullable(), location: z.string().nullable(),
  })).max(5),
});
export type DashboardData = z.infer<typeof dashboardSchema>;
export type DashboardResult = { data: DashboardData; error: null } | { data: null; error: 'setup' | 'unavailable' };

```

## app/admin/components/dashboard.tsx

```tsx
import Link from 'next/link';
import type { UserProfile } from '../../../lib/auth/profile';
import type { DashboardResult } from '../../../lib/dashboard/schema';
import { LogoutButton } from '../../cuenta/logout-button';
import styles from '../dashboard.module.css';
const date = new Intl.DateTimeFormat('es-CO', { day:'numeric', month:'short', year:'numeric', timeZone:'America/Bogota' });
const number = new Intl.NumberFormat('es-CO');
export function Dashboard({ profile, result, denied }: { profile: UserProfile; result: DashboardResult; denied: boolean }) {
  const { data, error } = result;
  const metrics = [
    { label:'Eventos', value:data?.events, detail:'Competencias organizadas', icon:'◈' },
    { label:'Equipos', value:data?.teams, detail:'Registros en tus eventos', icon:'▦' },
    { label:'Participantes', value:data?.participants, detail:'Miembros activos de equipos', icon:'◎' },
    { label:'Jueces', value:data?.judges, detail:'Activos y asignados', icon:'◇' },
  ];
  return <div className={styles.shell}>
    <aside className={styles.sidebar} aria-label="Navegación administrativa">
      <Link href="/" className={styles.brand}><span>R</span>RoboScore<span className={styles.dot}>.</span></Link>
      <p className={styles.navLabel}>TU ESPACIO</p>
      <nav><Link href="/admin" aria-current="page" className={styles.selected}>▦ <span>Resumen</span></Link><Link href="/admin/eventos">◈ <span>Eventos</span></Link><Link href="/cuenta">◎ <span>Mi cuenta</span></Link><Link href="/">↗ <span>Ver sitio público</span></Link></nav>
      <div className={styles.sidebarNote}><span className={styles.spark}>✦</span><strong>Grandes ideas.<br/>Grandes competencias.</strong><p>Todo empieza con un equipo.</p></div>
      <div className={styles.user}><span className={styles.avatar}>{(profile.first_name || profile.email || 'R').slice(0,1).toUpperCase()}</span><div><strong>{profile.first_name || 'Mi cuenta'}</strong><small>{profile.role === 'SUPER_ADMIN' ? 'Superadministrador' : 'Administrador'}</small></div></div>
      <LogoutButton/>
    </aside>
    <main className={styles.main}>
      <header className={styles.topbar}><span>Administración <span aria-hidden="true">/</span> <strong>Resumen</strong></span><Link href="/admin" className={styles.refresh}>↻ Actualizar</Link></header>
      {denied && <p role="alert" className={styles.alert}>No tienes permisos para el área solicitada. Este es tu espacio de administración.</p>}
      <section className={styles.welcome}><div><p className={styles.eyebrow}>EL SIGUIENTE GRAN RETO EMPIEZA AQUÍ</p><h1>Bienvenido{profile.first_name ? `, ${profile.first_name}` : ''}<span>.</span></h1><p>Una vista clara de tus competencias y de quienes las hacen posibles.</p></div><div className={styles.create}><Link href="/admin/eventos/nuevo" className={styles.newEvent}>+ Crear evento</Link></div></section>
      {error && <div className={styles.alert} role="alert"><strong>{error === 'setup' ? 'Falta activar el resumen de datos.' : 'No pudimos cargar el resumen.'}</strong><p>{error === 'setup' ? 'El panel está preparado. El administrador debe completar la configuración de esta fase en Supabase.' : 'Actualiza la página para volver a intentarlo. Tus datos no se han modificado.'}</p><span>Las cifras se mostrarán cuando podamos consultarlas.</span></div>}
      <section aria-label="Cifras generales" className={styles.metrics}>{metrics.map(item=><article className={styles.metric} key={item.label}><div><span>{item.label}</span><span className={styles.metricIcon} aria-hidden="true">{item.icon}</span></div><strong aria-label={item.value === undefined ? 'No disponible' : undefined}>{item.value === undefined ? '—' : number.format(item.value)}</strong><p>{item.detail}</p></article>)}</section>
      <div className={styles.columns}><section className={styles.events}><div className={styles.sectionHead}><div><p className={styles.eyebrow}>EN EL CALENDARIO</p><h2>En curso y por venir</h2></div><span className={styles.pill}>Hasta 5 eventos</span></div>
        {!data ? <div className={styles.empty}><span aria-hidden="true">◷</span><h3>Tu agenda aparecerá aquí</h3><p>Estamos esperando la conexión con los datos de tus competencias.</p></div> : data.next_events.length === 0 ? <div className={styles.empty}><span aria-hidden="true">⚑</span><h3>{data.events === 0 ? 'Tu primera competencia empieza contigo' : 'No hay eventos en la agenda'}</h3><p>{data.events === 0 ? 'Cuando crees tu primer evento, podrás seguir su avance desde este espacio.' : 'Consulta todas tus competencias desde Eventos.'}</p></div> : <ul className={styles.eventList}>{data.next_events.map(event=><li key={event.id}><div className={styles.eventMark} aria-hidden="true">◈</div><div className={styles.eventInfo}><h3><Link href={`/admin/eventos/${event.id}`}>{event.name}</Link></h3><p>{event.city || event.location || 'Lugar por definir'}</p><time dateTime={event.start_date}>{date.format(new Date(event.start_date))}</time></div><span className={event.status === 'ACTIVE' ? styles.active : styles.registration}>{event.status === 'ACTIVE' ? 'En curso' : 'Borrador'}</span></li>)}</ul>}
      </section><aside className={styles.activity}><p className={styles.eyebrow}>EL PULSO DE TUS EVENTOS</p><h2>Todo, a tu ritmo.</h2><div className={styles.activityRow}><span><i/>Eventos activos</span><strong>{data?.active_events ?? '—'}</strong></div><div className={styles.activityRow}><span><i/>Eventos próximos</span><strong>{data?.upcoming_events ?? '—'}</strong></div><p className={styles.scope}>{profile.role === 'SUPER_ADMIN' ? 'Estás viendo el resumen global de RoboScore.' : 'Estás viendo únicamente los eventos que has creado.'}</p><p className={styles.caption}>Las cifras se actualizan al abrir o actualizar esta página. Las fechas se muestran en hora de Colombia.</p></aside></div>
      <footer className={styles.footer}><span>RoboScore · Crear. Aprender. Competir.</span><span>Tu equipo, conectado.</span></footer>
    </main>
  </div>;
}

```

## app/admin/dashboard.module.css

```css
.shell{min-height:100svh;background:#f7f8fa;color:#1e293b;display:grid;grid-template-columns:248px minmax(0,1fr);font-family:Arial,Helvetica,sans-serif}.sidebar{background:#fff;border-right:1px solid #e8ebef;padding:32px 22px;display:flex;flex-direction:column;gap:22px;min-height:100svh}.brand{display:flex;align-items:center;font-size:23px;font-weight:800;text-decoration:none;color:#1e293b;letter-spacing:-1px}.brand>span:first-child{display:grid;place-items:center;width:36px;height:36px;background:#dc303c;color:white;border-radius:11px;margin-right:10px;transform:rotate(-5deg)}.dot{color:#dc303c}.navLabel{font-size:10px;font-weight:700;letter-spacing:1.7px;color:#7d8795;margin:24px 12px 0}.sidebar nav{display:grid;gap:7px}.sidebar nav a{padding:13px 15px;color:#697586;text-decoration:none;border-radius:10px;display:flex;gap:13px;align-items:center;font-size:14px}.sidebar nav a:hover{background:#f8fafc}.sidebar nav .selected{background:#fff0ee;color:#c02e3b;font-weight:700}.sidebarNote{margin-top:auto;background:#fcf3f0;border-radius:14px;padding:20px}.spark{display:block;color:#cc3945;font-size:28px;margin-bottom:15px}.sidebarNote strong{font-size:16px;line-height:1.5}.sidebarNote p{color:#8a706c;font-size:12px;line-height:1.5;margin-top:8px}.user{display:flex;gap:10px;align-items:center;border-top:1px solid #edf0f3;padding-top:20px}.avatar{width:35px;height:35px;display:grid;place-items:center;border-radius:50%;background:#f0e8e5;color:#93433d}.user strong{font-size:13px;display:block;overflow-wrap:anywhere}.user small{font-size:11px;color:#6b7280;display:block;margin-top:4px}.sidebar form button{width:100%;min-height:42px;font-size:13px}.main{padding:0 44px;max-width:1530px;width:100%;margin:auto;min-width:0}.topbar{min-height:83px;display:flex;justify-content:space-between;align-items:center;gap:15px;border-bottom:1px solid #e6e9ed;font-size:12px;color:#8b94a2}.topbar strong{font-weight:500;color:#475569}.topbar span span{margin:0 14px;color:#b4bac3}.refresh{color:#526071;text-decoration:none;border:1px solid #dfe4ea;background:white;padding:10px 14px;border-radius:9px;white-space:nowrap}.welcome{padding:43px 0 30px;display:flex;justify-content:space-between;align-items:center;gap:24px}.eyebrow{font-size:10px;letter-spacing:1.5px;font-weight:700;color:#a45458;margin:0 0 12px}.welcome h1{font-size:clamp(28px,3vw,43px);line-height:1.2;font-weight:750;letter-spacing:-1.7px;margin:0 0 13px;overflow-wrap:anywhere}.welcome h1 span{color:#d63743}.welcome p:not(.eyebrow){font-size:14px;line-height:1.7;color:#738092;max-width:480px;margin:0}.create{display:flex;flex-direction:column;align-items:center;gap:9px;flex-shrink:0}.create button{background:#f2d7d9;color:#865a60;border:1px solid #e8bfc3;border-radius:9px;padding:13px 19px;font-size:13px;font-weight:700;cursor:not-allowed}.create small{font-size:10px;color:#7b8593}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;margin-bottom:28px}.metric{background:white;border:1px solid #e7eaef;border-radius:14px;padding:22px}.metric>div{display:flex;justify-content:space-between;align-items:center;gap:7px;font-size:13px;color:#657286}.metricIcon{width:30px;height:30px;background:#fff2f0;color:#bb535a;border-radius:9px;display:grid;place-items:center;font-size:20px}.metric>strong{display:block;font-size:36px;letter-spacing:-1.7px;line-height:1.3;margin:15px 0 7px;font-weight:700}.metric p{font-size:11px;line-height:1.6;color:#7f8998;margin:0}.columns{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(240px,1fr);gap:24px}.events{background:white;border:1px solid #e7eaef;border-radius:16px;overflow:hidden}.sectionHead{padding:25px 25px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}.sectionHead h2,.activity h2{font-size:20px;font-weight:700;letter-spacing:-.5px;margin:0}.sectionHead .eyebrow{margin-bottom:8px}.pill{font-size:10px;padding:7px 9px;background:#f5f6f8;border-radius:20px;color:#7e8794;white-space:nowrap}.empty{min-height:255px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px}.empty>span{width:55px;height:55px;display:grid;place-items:center;background:#fff2ef;color:#ba6963;border-radius:18px;font-size:27px;margin-bottom:18px}.empty h3{font-size:16px;font-weight:650;line-height:1.5;margin:0 0 9px}.empty p{max-width:300px;font-size:13px;line-height:1.8;color:#7b8796;margin:0}.activity{background:#f3e8e3;border:1px solid #eaded8;border-radius:16px;padding:27px}.activity h2{font-size:25px;line-height:1.3;margin-bottom:23px}.activityRow{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:18px 0;border-bottom:1px solid #e4d7d1;font-size:13px}.activityRow>span{display:flex;align-items:center;gap:8px}.activityRow i{width:6px;height:6px;border-radius:50%;background:#ad665c}.activityRow strong{font-size:24px}.scope{font-size:12px;line-height:1.8;color:#775f59;margin:22px 0 12px}.caption{font-size:11px;line-height:1.8;color:#856f69}.footer{display:flex;justify-content:space-between;gap:15px;font-size:10px;color:#9199a4;padding:26px 0;margin-top:12px}.alert{padding:18px 22px;border:1px solid #e6ccad;border-radius:12px;background:#fff8ec;color:#795831;font-size:13px;line-height:1.7;margin:20px 0}.alert p{margin:5px 0}.alert>span{font-size:12px}.eventList{list-style:none;margin:0;padding:0 25px 15px}.eventList li{display:flex;gap:13px;align-items:center;padding:20px 0;border-top:1px solid #edf0f3}.eventMark{flex-shrink:0;width:42px;height:42px;background:#f9eeeb;border-radius:12px;display:grid;place-items:center;color:#be625d;font-size:23px}.eventInfo{flex:1;min-width:0}.eventInfo h3{font-size:14px;font-weight:700;line-height:1.5;overflow-wrap:anywhere;margin:0 0 5px}.eventInfo p,.eventInfo time{font-size:11px;color:#788493;line-height:1.7;margin:0}.active,.registration{border-radius:20px;padding:6px 9px;font-size:10px;white-space:nowrap}.active{background:#eaf5ef;color:#34634d}.registration{background:#fff2df;color:#8a6024}.shell a:focus-visible,.shell button:focus-visible{outline:3px solid #c1343e;outline-offset:4px}
@media(min-width:1450px){.main{padding-inline:64px}}@media(max-width:1150px){.shell{grid-template-columns:215px minmax(0,1fr)}.main{padding:0 25px}.metrics{gap:12px}.metric{padding:17px}.columns{grid-template-columns:1fr}.activity{display:block}.sidebar{padding:27px 16px}}@media(max-width:760px){.shell{display:block}.sidebar{min-height:auto;padding:18px 20px;gap:15px;border-right:0;border-bottom:1px solid #e8ebef}.brand{font-size:22px}.sidebar nav{display:flex;flex-wrap:wrap;gap:5px}.sidebar nav a{padding:9px 11px;font-size:12px}.sidebarNote,.navLabel,.sidebar .user,.sidebar>form{display:none}.main{padding:0 20px}.topbar{min-height:65px}.welcome{padding-top:27px;align-items:flex-start;flex-direction:column;gap:20px}.create{align-items:flex-start}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.metric>strong{font-size:31px}.metric>div{font-size:12px}.sectionHead{padding:21px 18px;align-items:flex-start;flex-direction:column}.sectionHead h2{font-size:20px}.eventList{padding:0 18px 12px}.eventList li{flex-wrap:wrap}.eventInfo{min-width:120px}.footer{flex-direction:column;gap:9px}.topbar span span{margin:0 7px}.empty{padding:25px 18px}.welcome h1{letter-spacing:-1px}.metric{padding:15px}.metrics{gap:10px}.metricIcon{width:24px;height:24px}.activity{padding:24px}}

.newEvent{display:inline-flex;background:#d92e3a;color:#fff;border-radius:10px;padding:13px 19px;text-decoration:none;font-size:14px;font-weight:650}.newEvent:hover{background:#b72531}.eventInfo h3 a{color:inherit;text-decoration:none}.eventInfo h3 a:hover{text-decoration:underline}

```

## supabase/migrations/202609200002_event_management.sql

```sql
-- FASE 9. Repetible; no borra eventos ni modifica las otras tablas.
BEGIN;
CREATE OR REPLACE FUNCTION roboscore_private.is_event_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id=(SELECT auth.uid()) AND active AND role IN ('ADMIN','SUPER_ADMIN'));
$$;
REVOKE ALL ON FUNCTION roboscore_private.is_event_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION roboscore_private.is_event_admin() TO authenticated;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.events TO authenticated;
GRANT INSERT (id,name,slug,description,start_date,end_date,registration_start,registration_end,location,city,address,status,logo_url,organizer_name,created_by,max_teams,rules_url,public) ON public.events TO authenticated;
GRANT UPDATE (name,description,start_date,end_date,registration_start,registration_end,location,city,address,status,logo_url,organizer_name,max_teams,rules_url,public) ON public.events TO authenticated;
DROP POLICY IF EXISTS events_admin_read ON public.events;
CREATE POLICY events_admin_read ON public.events FOR SELECT TO authenticated
USING ((SELECT roboscore_private.is_event_admin()) AND (created_by=(SELECT auth.uid()) OR (SELECT roboscore_private.is_super_admin())));
DROP POLICY IF EXISTS events_admin_create ON public.events;
CREATE POLICY events_admin_create ON public.events FOR INSERT TO authenticated
WITH CHECK ((SELECT roboscore_private.is_event_admin()) AND created_by=(SELECT auth.uid()));
DROP POLICY IF EXISTS events_admin_update ON public.events;
CREATE POLICY events_admin_update ON public.events FOR UPDATE TO authenticated
USING ((SELECT roboscore_private.is_event_admin()) AND (created_by=(SELECT auth.uid()) OR (SELECT roboscore_private.is_super_admin())))
WITH CHECK ((SELECT roboscore_private.is_event_admin()) AND (created_by=(SELECT auth.uid()) OR (SELECT roboscore_private.is_super_admin())));
-- No DELETE. No permisos UPDATE para created_by/id/slug/timestamps.
-- public=true no abre lectura a visitantes ni jueces en esta fase.
NOTIFY pgrst, 'reload schema';
COMMIT;

```

## supabase/verify-phase-9.sql

```sql
-- Todos los resultados deben ser true después de instalar la fase 9.
SELECT '01. Events mantiene RLS' AS check_name, relrowsecurity AS passed
FROM pg_class WHERE oid='public.events'::regclass
UNION ALL
SELECT '02. Tres políticas administrativas instaladas',count(*)=3 FROM pg_policies
WHERE schemaname='public' AND tablename='events' AND policyname IN ('events_admin_read','events_admin_create','events_admin_update')
UNION ALL
SELECT '03. Lectura authenticated sujeta a RLS',has_table_privilege('authenticated','public.events','SELECT')
UNION ALL
SELECT '04. Escritura de campos permitidos',has_column_privilege('authenticated','public.events','name','INSERT') AND has_column_privilege('authenticated','public.events','name','UPDATE')
UNION ALL
SELECT '05. Propietario e identificadores inmutables',NOT has_column_privilege('authenticated','public.events','created_by','UPDATE') AND NOT has_column_privilege('authenticated','public.events','id','UPDATE') AND NOT has_column_privilege('authenticated','public.events','slug','UPDATE')
UNION ALL
SELECT '06. Sin borrado permanente',NOT has_table_privilege('authenticated','public.events','DELETE')
UNION ALL
SELECT '07. Anon sin lectura ni escritura',NOT has_table_privilege('anon','public.events','SELECT') AND NOT has_any_column_privilege('anon','public.events','INSERT') AND NOT has_any_column_privilege('anon','public.events','UPDATE')
UNION ALL
SELECT '08. Helper limitado a autenticados',has_function_privilege('authenticated','roboscore_private.is_event_admin()','EXECUTE') AND NOT has_function_privilege('anon','roboscore_private.is_event_admin()','EXECUTE')
ORDER BY check_name;

```

## package.json

```json
{
  "name": "robotics-scoring",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@supabase/ssr": "^0.12.7",
    "@supabase/supabase-js": "^2.116.0",
    "next": "16.3.5",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "server-only": "^0.0.1",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@electric-sql/pglite": "^0.5.8",
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.3.5",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}

```