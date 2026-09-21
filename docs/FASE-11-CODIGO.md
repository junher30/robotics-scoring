# Fase 11 · Código completo del módulo

Código de esta entrega. Los archivos originales del proyecto son la fuente de verdad. No incluye variables de entorno ni credenciales.

## app/admin/usuarios/[id]/page.tsx

````tsx
import type {Metadata} from 'next';
import Link from 'next/link';
import {readManagedUser} from '../../../../lib/users/access';
import {roleLabels,userValues} from '../../../../lib/users/schema';
import {UserShell} from '../shell';
import {UserForm} from '../user-form';
import s from '../../eventos/events.module.css';
import styles from '../users.module.css';
export const metadata:Metadata={title:'Cuenta de usuario | RoboScore',robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{resultado?:string}>}) {
  const {actor,user}=await readManagedUser((await params).id);
  const locked=user.id===actor.id||user.role==='SUPER_ADMIN';
  return <UserShell superAdmin={actor.role==='SUPER_ADMIN'}><div className={styles.narrow}><header className={s.title}><p>{roleLabels[user.role]}</p><h1>{[user.first_name,user.last_name].filter(Boolean).join(' ')||'Cuenta de usuario'}</h1><span>Información y acceso a RoboScore.</span></header>
    {(await searchParams).resultado==='guardado'&&<p role="status" className={s.success}>Cambios guardados.</p>}
    {locked?<section className={s.card}><h2>Cuenta protegida</h2><p className={s.muted}>Este módulo no modifica tu propia cuenta ni las cuentas de superadministrador.</p><dl className={styles.details}><dt>Correo</dt><dd>{user.email}</dd><dt>Rol</dt><dd>{roleLabels[user.role]}</dd><dt>Estado</dt><dd>{user.active?'Activa':'Desactivada'}</dd></dl><Link href="/admin/usuarios" className={s.secondary}>Volver al listado</Link></section>:<UserForm id={user.id} version={user.updated_at} initial={userValues(user)} superAdmin={actor.role==='SUPER_ADMIN'}/>}
  </div></UserShell>;
}

````

## app/admin/usuarios/actions.ts

````ts
'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserManager } from '../../../lib/users/access';
import { inviteSchema,editUserSchema,type UserState,type UserValues } from '../../../lib/users/schema';
import { createClient } from '../../../lib/supabase/server';
import { createAdminClient,invitationConfig } from '../../../lib/supabase/admin';
function values(form: FormData): UserValues {
  return { first_name:String(form.get('first_name') ?? ''),last_name:String(form.get('last_name') ?? ''),email:String(form.get('email') ?? ''),phone:String(form.get('phone') ?? ''),role:String(form.get('role') ?? ''),active:String(form.get('active') ?? 'true') };
}
function databaseMessage(error: {code?: string;message?: string}) {
  if (['42501','22023','23505','40001','P0001'].includes(error.code ?? '')) return error.message ?? 'No se pudo completar el cambio.';
  return 'No pudimos completar la operación. Revisa la conexión y que esté aplicado el SQL de usuarios.';
}
function refreshUsers() { ['/admin','/admin/usuarios','/admin/jueces','/admin/administradores'].forEach(path=>revalidatePath(path)); }
export async function inviteUser(_previous: UserState,form: FormData): Promise<UserState> {
  const actor = await requireUserManager();
  const raw = values(form), parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) return {values:raw,message:'Revisa los campos indicados.',errors:parsed.error.flatten().fieldErrors};
  if (actor.role !== 'SUPER_ADMIN' && parsed.data.role !== 'JUDGE') return {values:raw,message:'Solo el superadministrador puede invitar administradores.'};
  let redirectTo: string;
  try { redirectTo = invitationConfig().redirectTo; } catch { return {values:raw,message:'Falta configurar el servicio de invitaciones en el servidor. Sigue la guía de la fase 11.'}; }
  try {
    const client = await createClient();
    const v = parsed.data;
    const {data:invitation,error} = await client.rpc('roboscore_prepare_user_invitation',{p_email:v.email,p_first_name:v.first_name,p_last_name:v.last_name,p_phone:v.phone,p_role:v.role});
    if (error) return {values:raw,message:databaseMessage(error)};
    if (!z.string().uuid().safeParse(invitation).success) return {values:raw,message:'No se pudo preparar la invitación.'};
    const admin = createAdminClient();
    const result = await admin.auth.admin.inviteUserByEmail(v.email,{redirectTo,data:{roboscore_invitation_id:invitation}});
    if (result.error) return {values:raw,message:result.error.status === 429 ? 'Supabase limitó los envíos. Espera unos minutos antes de reintentar.' : 'No se pudo enviar el correo. Revisa el servicio de correo de Supabase; si la cuenta ya existe, busca su ficha. Puedes reintentar después de un minuto.'};
    refreshUsers();
    return {success:true,message:'Invitación enviada. La persona recibirá un enlace para crear su contraseña.',values:raw};
  } catch { return {values:raw,message:'No pudimos confirmar el envío. Revisa el listado antes de reintentar; si no llegó el correo, espera un minuto y usa el mismo correo.'}; }
}
export async function updateUser(id: string,version: string,_previous: UserState,form: FormData): Promise<UserState> {
  const actor = await requireUserManager();
  const raw = values(form), parsed = editUserSchema.safeParse(raw);
  if (!parsed.success) return {values:raw,message:'Revisa los campos indicados.',errors:parsed.error.flatten().fieldErrors};
  if (!z.string().uuid().safeParse(id).success || !z.string().datetime({offset:true}).safeParse(version).success) return {values:raw,message:'Abre de nuevo la ficha de la cuenta.'};
  if (id === actor.id || (actor.role !== 'SUPER_ADMIN' && parsed.data.role !== 'JUDGE')) return {values:raw,message:'No puedes modificar esta cuenta o asignar ese rol.'};
  try {
    const client = await createClient(), v = parsed.data;
    const {data,error} = await client.rpc('roboscore_update_managed_user',{p_id:id,p_version:version,p_first_name:v.first_name,p_last_name:v.last_name,p_phone:v.phone,p_role:v.role,p_active:v.active === 'true'});
    if (error) return {values:raw,message:databaseMessage(error)};
    if (data !== id) return {values:raw,message:'No se pudo confirmar el cambio. Recarga la ficha antes de intentar otra vez.'};
  } catch { return {values:raw,message:'No pudimos confirmar el cambio. Conserva tus datos y vuelve a cargar la ficha.'}; }
  refreshUsers(); revalidatePath(`/admin/usuarios/${id}`);
  redirect(`/admin/usuarios/${id}?resultado=guardado`);
}

````

## app/admin/usuarios/directory.tsx

````tsx
import Link from 'next/link';
import { requireUserManager,userColumns } from '../../../lib/users/access';
import { createClient } from '../../../lib/supabase/server';
import { roleLabels,type ManagedUser } from '../../../lib/users/schema';
import { UserShell } from './shell';
import s from '../eventos/events.module.css';
import styles from './users.module.css';
export type DirectoryQuery = {rol?:string;estado?:string;pagina?:string};
export async function UserDirectory({kind,query}:{kind:'all'|'judges'|'admins';query:DirectoryQuery}) {
  const actor = await requireUserManager(kind !== 'judges');
  const superAdmin = actor.role === 'SUPER_ADMIN';
  const base = kind === 'judges' ? '/admin/jueces' : kind === 'admins' ? '/admin/administradores' : '/admin/usuarios';
  const title = kind === 'judges' ? 'Jueces' : kind === 'admins' ? 'Administradores' : 'Usuarios';
  const role = kind === 'judges' ? 'JUDGE' : kind === 'admins' ? 'ADMIN' : ['ADMIN','JUDGE','SUPER_ADMIN'].includes(query.rol ?? '') ? query.rol : undefined;
  const active = ['true','false'].includes(query.estado ?? '') ? query.estado : undefined;
  const page = /^[1-9]\d{0,5}$/.test(query.pagina ?? '') ? Number(query.pagina) : 1;
  let rows:ManagedUser[]=[],count=0,failed=false;
  try {
    const client = await createClient();
    let request = client.from('profiles').select(userColumns,{count:'exact'}).order('created_at',{ascending:false}).order('id').range((page-1)*20,page*20-1);
    if (role) request=request.eq('role',role);
    if (active) request=request.eq('active',active==='true');
    if (!superAdmin) request=request.eq('managed_by',actor.id);
    const result = await request.returns<ManagedUser[]>();
    failed=Boolean(result.error); rows=result.data??[]; count=result.count??0;
  } catch {failed=true;}
  const pageUrl=(value:number)=>`${base}?${new URLSearchParams({...(role ? {rol:role}:{}),...(active ? {estado:active}:{}),pagina:String(value)})}`;
  const inviteUrl=kind==='judges' ? '/admin/jueces/nuevo' : `/admin/usuarios/nuevo${kind==='admins' ? '?rol=ADMIN':''}`;
  return <UserShell superAdmin={superAdmin}>
    <div className={s.titleRow}><header className={s.title}><p>LAS PERSONAS DETRÁS DE CADA RETO</p><h1>{title}<span aria-hidden="true">.</span></h1><span>{kind==='judges' ? 'Prepara el equipo que acompañará y evaluará la competencia.' : 'Organiza los accesos y acompaña a tu equipo de trabajo.'}</span></header><Link href={inviteUrl} className={s.primary}>+ {kind==='judges'?'Invitar juez':kind==='admins'?'Invitar administrador':'Invitar usuario'}</Link></div>
    {superAdmin && <nav className={styles.directoryTabs} aria-label="Tipos de usuario"><Link href="/admin/usuarios" aria-current={kind==='all'?'page':undefined}>Todos los usuarios</Link><Link href="/admin/administradores" aria-current={kind==='admins'?'page':undefined}>Administradores</Link><Link href="/admin/jueces" aria-current={kind==='judges'?'page':undefined}>Jueces</Link></nav>}
    <form method="get" className={s.filters}>{kind==='all' && <><label htmlFor="rol">Rol</label><select id="rol" name="rol" defaultValue={role??''}><option value="">Todos</option>{Object.entries(roleLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></>}<label htmlFor="estado">Estado</label><select id="estado" name="estado" defaultValue={active??''}><option value="">Todos</option><option value="true">Activos</option><option value="false">Desactivados</option></select><button className={s.secondary}>Filtrar</button><Link href={base} className={s.textLink}>Limpiar</Link></form>
    {failed ? <div className={s.error} role="alert">No pudimos cargar las cuentas. Revisa la conexión y la configuración de usuarios. <Link href={base}>Reintentar</Link></div> : <><p className={s.muted}>{count} {count===1?'cuenta':'cuentas'} · Página {page}{!superAdmin?' · Solo los jueces que has invitado':''}</p>
    {rows.length===0 ? <section className={s.empty}><span aria-hidden="true">◎</span><h2>{active||page>1?'No hay cuentas en esta vista':'Un gran evento empieza con su equipo'}</h2><p>{active||page>1?'Cambia el filtro para consultar otras cuentas.':'Envía una invitación. Cada persona creará su propia contraseña desde su correo.'}</p><Link href={active||page>1?base:inviteUrl} className={s.primary}>{active||page>1?'Ver todas':'Enviar una invitación'}</Link></section> : <div className={s.list}>{rows.map(user=><article className={s.event} key={user.id}><div className={styles.person}><span className={styles.avatar} aria-hidden="true">{(user.first_name||user.email||'U').slice(0,1).toUpperCase()}</span><div className={styles.personInfo}><h2><Link href={`/admin/usuarios/${user.id}`}>{[user.first_name,user.last_name].filter(Boolean).join(' ')||'Cuenta sin nombre'}</Link></h2><p>{user.email||'Correo no disponible'}</p><p>Creada el {new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',dateStyle:'medium'}).format(new Date(user.created_at))}</p><div className={styles.badges}><span className={s.badge}>{roleLabels[user.role]}</span><span className={`${styles.state} ${!user.active?styles.inactive:''}`}>{user.active?'Activa':'Desactivada'}</span></div></div></div><Link className={s.secondary} href={`/admin/usuarios/${user.id}`}>Ver cuenta →</Link></article>)}</div>}
    <nav className={s.pagination} aria-label="Páginas de usuarios">{page>1&&<Link className={s.secondary} href={pageUrl(page-1)}>← Anterior</Link>}{page*20<count&&<Link className={s.secondary} href={pageUrl(page+1)}>Siguiente →</Link>}</nav></>}
  </UserShell>;
}

````

## app/admin/usuarios/error.tsx

````tsx
'use client';
import Link from 'next/link';
import s from '../eventos/events.module.css';
export default function ErrorPage({reset}:{reset:()=>void}) {return <main className={s.main}><section className={s.empty}><h1>No pudimos cargar las cuentas</h1><p>Revisa la conexión y la configuración de usuarios.</p><button className={s.primary} onClick={reset}>Reintentar</button> <Link href="/admin" className={s.secondary}>Volver al resumen</Link></section></main>;}

````

## app/admin/usuarios/invite-page.tsx

````tsx
import {requireUserManager} from '../../../lib/users/access';
import {invitationsReady} from '../../../lib/supabase/admin';
import {blankUser} from '../../../lib/users/schema';
import {UserShell} from './shell';
import {UserForm} from './user-form';
import s from '../eventos/events.module.css';
import styles from './users.module.css';
export async function InvitePage({judgeOnly=false,role='JUDGE'}:{judgeOnly?:boolean;role?:string}) {
  const actor=await requireUserManager(!judgeOnly);
  const ready=invitationsReady();
  return <UserShell superAdmin={actor.role==='SUPER_ADMIN'}><div className={styles.narrow}><header className={s.title}><p>SUMA TALENTO A TU EQUIPO</p><h1>{judgeOnly?'Invitar juez.':'Invitar usuario.'}</h1><span>Un acceso personal para cada integrante de la organización.</span></header>
    {!ready&&<div className={styles.notice} role="status"><strong>Las invitaciones necesitan una configuración inicial.</strong><p>Completa la configuración del servidor y del correo siguiendo la guía de la fase 11. Después podrás enviar invitaciones desde aquí.</p></div>}
    <UserForm superAdmin={actor.role==='SUPER_ADMIN'} judgeOnly={judgeOnly} ready={ready} initial={{...blankUser,role:!judgeOnly&&role==='ADMIN'?'ADMIN':'JUDGE'}}/>
  </div></UserShell>;
}

````

## app/admin/usuarios/not-found.tsx

````tsx
import Link from 'next/link';
import s from '../eventos/events.module.css';
export default function NotFound() {return <main className={s.main}><section className={s.empty}><h1>Cuenta no disponible</h1><p>Este enlace no está disponible o no tienes permisos para consultar la cuenta.</p><Link className={s.primary} href="/admin">Volver al resumen</Link></section></main>;}

````

## app/admin/usuarios/nuevo/page.tsx

````tsx
import type {Metadata} from 'next';
import {InvitePage} from '../invite-page';
export const metadata:Metadata={title:'Invitar usuario | RoboScore',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{rol?:string}>}) {return <InvitePage role={(await searchParams).rol}/>;}

````

## app/admin/usuarios/page.tsx

````tsx
import type {Metadata} from 'next';
import {UserDirectory,type DirectoryQuery} from './directory';
export const metadata:Metadata={title:'Usuarios | RoboScore',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<DirectoryQuery>}) {return <UserDirectory kind="all" query={await searchParams}/>;}

````

## app/admin/usuarios/shell.tsx

````tsx
import Link from 'next/link';
import type {ReactNode} from 'react';
import s from '../eventos/events.module.css';
import styles from './users.module.css';
export function UserShell({children,superAdmin=false}:{children:ReactNode;superAdmin?:boolean}) {
  return <div className={s.screen}><header className={s.header}><Link href="/admin" className={s.brand}><span>R</span>RoboScore.</Link><nav aria-label="Administración" className={styles.navigation}><Link href="/admin">Resumen</Link><Link href="/admin/eventos">Eventos</Link><Link href="/admin/jueces">Jueces</Link>{superAdmin && <Link href="/admin/usuarios">Usuarios</Link>}<Link href="/cuenta">Mi cuenta</Link></nav></header><main className={s.main}>{children}</main><footer className={s.footer}>RoboScore · Crear. Aprender. Competir.</footer></div>;
}

````

## app/admin/usuarios/user-form.tsx

````tsx
'use client';
import {useActionState,useEffect,useRef} from 'react';
import Link from 'next/link';
import {inviteUser,updateUser} from './actions';
import {blankUser,type UserValues,type UserState} from '../../../lib/users/schema';
import s from '../eventos/events.module.css';
import styles from './users.module.css';
export function UserForm({id,version,initial=blankUser,superAdmin,judgeOnly=false,ready=true}:{id?:string;version?:string;initial?:UserValues;superAdmin:boolean;judgeOnly?:boolean;ready?:boolean}) {
  const editing=Boolean(id&&version);
  const [state,action,pending]=useActionState<UserState,FormData>(id&&version?updateUser.bind(null,id,version):inviteUser,{});
  const notice=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(state.message) notice.current?.focus();},[state]);
  const values=state.values??initial;
  const error=(field:keyof UserValues)=>state.errors?.[field]?.[0];
  const props=(field:keyof UserValues)=>({'aria-invalid':Boolean(error(field)),'aria-describedby':error(field)?`${field}-error`:undefined});
  const fieldError=(field:keyof UserValues)=>error(field)?<p id={`${field}-error`} className={s.fieldError}>{error(field)}</p>:null;
  const back=superAdmin&&!judgeOnly?'/admin/usuarios':'/admin/jueces';
  return <form action={action} noValidate aria-busy={pending}>
    {state.message&&<div ref={notice} tabIndex={-1} role={state.success?'status':'alert'} className={state.success?s.success:s.error}>{state.message}{state.success&&<p><Link href={back}>Volver al listado →</Link></p>}</div>}
    <fieldset className={s.formFields} disabled={pending||!ready||Boolean(state.success)}>
      <section className={s.card}><h2>{editing?'Datos de la cuenta':'Una invitación para formar parte'}</h2><p className={s.muted}>{editing?'Actualiza los datos y el acceso a RoboScore.':'La persona recibirá un correo para aceptar la invitación y crear su contraseña.'} Los campos con * son obligatorios.</p>
        <div className={s.grid}>{(['first_name','last_name'] as const).map(field=><div className={s.field} key={field}><label htmlFor={field}>{field==='first_name'?'Nombre':'Apellido'} *</label><input id={field} name={field} autoComplete={field==='first_name'?'given-name':'family-name'} maxLength={field==='first_name'?100:150} required defaultValue={values[field]} {...props(field)}/>{fieldError(field)}</div>)}</div>
        <div className={s.field}><label htmlFor="email">Correo electrónico{!editing?' *':''}</label><input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required={!editing} readOnly={editing} defaultValue={values.email} {...props('email')}/>{fieldError('email')}{editing&&<p className={styles.fieldNote}>El correo está vinculado a la cuenta de acceso y no se cambia desde esta ficha.</p>}</div>
        <div className={s.field}><label htmlFor="phone">Teléfono (opcional)</label><input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={40} defaultValue={values.phone} {...props('phone')}/>{fieldError('phone')}</div>
        {superAdmin&&!judgeOnly?<div className={s.field}><label htmlFor="role">Rol *</label><select id="role" name="role" defaultValue={values.role} {...props('role')}><option value="JUDGE">Juez</option><option value="ADMIN">Administrador</option></select>{fieldError('role')}<p className={styles.fieldNote}>Un administrador puede crear eventos y gestionar sus jueces. Un juez evaluará las categorías que tenga asignadas.</p></div>:<><input type="hidden" name="role" value="JUDGE"/><p className={s.muted}>Rol: Juez</p></>}
        {editing&&<div className={s.field}><label htmlFor="active">Acceso a RoboScore *</label><select id="active" name="active" defaultValue={values.active} {...props('active')}><option value="true">Activo</option><option value="false">Desactivado</option></select>{fieldError('active')}<p className={styles.fieldNote}>Al desactivar se bloquea el acceso a los datos de RoboScore. La cuenta y su historial se conservan.</p></div>}
      </section>
      <div className={s.actions}><Link className={s.secondary} href={back}>Volver al listado</Link><button className={s.primary} disabled={pending||!ready||Boolean(state.success)}>{pending?(editing?'Guardando…':'Enviando invitación…'):(editing?'Guardar cambios':'Enviar invitación')}</button></div>
    </fieldset>
  </form>;
}

````

## app/admin/usuarios/users.module.css

````css
.navigation{flex-wrap:wrap}.directoryTabs{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 25px}.directoryTabs a{padding:10px 16px;color:#66758b;border:1px solid #dce2ea;border-radius:999px;background:#fff;text-decoration:none;font-size:13px}.directoryTabs a[aria-current]{background:#fff0f1;border-color:#e9adb2;color:#b72936}.person{display:flex;gap:18px;align-items:center;min-width:0}.avatar{width:46px;height:46px;flex-shrink:0;display:grid;place-items:center;border-radius:14px;background:#fdf0f1;color:#b52d39;font-size:18px;font-weight:700}.personInfo{min-width:0}.personInfo h2{margin:0 0 6px}.personInfo p{overflow-wrap:anywhere}.badges{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}.state{font-size:11px;background:#ecf7ef;color:#346847;padding:5px 9px;border-radius:20px}.inactive{background:#f1f3f6;color:#677183}.summary{display:flex;gap:18px;flex-wrap:wrap;margin:0 0 20px;color:#68768b;font-size:13px}.summary span{overflow-wrap:anywhere}.narrow{max-width:730px;margin:auto}.notice{padding:18px 20px;border:1px solid #ecdcb8;border-radius:12px;background:#fffaf0;color:#7d6432;font-size:14px;line-height:1.8;margin:0 0 24px}.notice p{margin:6px 0 0}.fieldNote{font-size:12px;line-height:1.7;color:#758298}.protected{font-size:13px;color:#7b8391;padding:8px 0}.details{display:grid;grid-template-columns:120px 1fr;gap:14px;font-size:14px;line-height:1.6}.details dt{color:#758298}.details dd{margin:0;overflow-wrap:anywhere}@media(max-width:650px){.navigation{gap:16px!important}.person{align-items:flex-start;gap:12px}.avatar{width:36px;height:36px;border-radius:10px}.details{grid-template-columns:1fr;gap:5px}.details dd{margin-bottom:15px}}

````

## app/admin/jueces/nuevo/page.tsx

````tsx
import type {Metadata} from 'next';
import {InvitePage} from '../../usuarios/invite-page';
export const metadata:Metadata={title:'Invitar juez | RoboScore',robots:{index:false,follow:false}};
export default function Page() {return <InvitePage judgeOnly/>;}

````

## app/admin/jueces/page.tsx

````tsx
import type {Metadata} from 'next';
import {UserDirectory,type DirectoryQuery} from '../usuarios/directory';
export const metadata:Metadata={title:'Jueces | RoboScore',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<DirectoryQuery>}) {return <UserDirectory kind="judges" query={await searchParams}/>;}

````

## app/admin/administradores/page.tsx

````tsx
import type {Metadata} from 'next';
import {UserDirectory,type DirectoryQuery} from '../usuarios/directory';
export const metadata:Metadata={title:'Administradores | RoboScore',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<DirectoryQuery>}) {return <UserDirectory kind="admins" query={await searchParams}/>;}

````

## app/auth/invitacion/accept-form.tsx

````tsx
'use client';
import {useActionState} from 'react';
import {acceptInvitation,type AcceptState} from './actions';
import s from '../../admin/eventos/events.module.css';
export function AcceptForm({token}:{token:string}) {
  const [state,action,pending]=useActionState<AcceptState,FormData>(acceptInvitation.bind(null,token),{});
  return <form action={action} aria-busy={pending}>{state.message&&<p role="alert" className={s.error}>{state.message}</p>}<button className={s.primary} disabled={pending}>{pending?'Confirmando…':'Aceptar invitación'}</button></form>;
}

````

## app/auth/invitacion/actions.ts

````ts
'use server';
import {redirect} from 'next/navigation';
import {createClient} from '../../../lib/supabase/server';
export type AcceptState={message?:string};
export async function acceptInvitation(token:string,_previous:AcceptState):Promise<AcceptState> {
  void _previous;
  if (!/^[a-f0-9]{40,128}$/i.test(token)) return {message:'El enlace no es válido. Solicita una nueva invitación al organizador.'};
  try {
    const client=await createClient(false);
    const {data,error}=await client.auth.verifyOtp({token_hash:token,type:'invite'});
    if (error||!data.user) return {message:'El enlace venció o ya fue utilizado. Si ya creaste tu contraseña, inicia sesión. Si no, pide al organizador una nueva invitación.'};
    const profile=await client.from('profiles').select('active').eq('id',data.user.id).single();
    if (profile.error||!profile.data?.active) {
      await client.auth.signOut({scope:'local'});
      return {message:'La cuenta no está habilitada. Contacta al organizador.'};
    }
  } catch {return {message:'No pudimos confirmar el acceso. Inténtalo nuevamente.'};}
  redirect('/cuenta/crear-clave');
}

````

## app/auth/invitacion/page.tsx

````tsx
import type {Metadata} from 'next';
import Link from 'next/link';
import {AcceptForm} from './accept-form';
import s from '../../admin/eventos/events.module.css';
import styles from '../../admin/usuarios/users.module.css';
export const metadata:Metadata={title:'Tu invitación | RoboScore',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page({searchParams}:{searchParams:Promise<{token_hash?:string}>}) {
  const token=(await searchParams).token_hash??'';
  const valid=/^[a-f0-9]{40,128}$/i.test(token);
  return <div className={s.screen}><main className={s.main}><div className={styles.narrow}><Link href="/" className={s.brand}><span>R</span>RoboScore.</Link><section className={s.card} style={{marginTop:35}}><header className={s.title}><p>TU EQUIPO TE ESPERA</p><h1>{valid?'Tienes una invitación.':'Revisa tu enlace.'}</h1><span>{valid?'Acepta para verificar tu correo y elegir una contraseña personal.':'Abre el enlace completo que recibiste en el correo de invitación.'}</span></header>{valid&&<AcceptForm token={token}/>}<p className={s.muted}>¿Ya tienes contraseña? <Link href="/login">Inicia sesión</Link>.</p></section></div></main></div>;
}

````

## app/cuenta/crear-clave/actions.ts

````ts
'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireAccess,homeForRole} from '../../../lib/auth/authorization';
import {createClient} from '../../../lib/supabase/server';
import {passwordSchema,type PasswordState} from '../../../lib/users/password';
export async function savePassword(_previous:PasswordState,form:FormData):Promise<PasswordState> {
  const profile=await requireAccess();
  const parsed=passwordSchema.safeParse({password:form.get('password'),confirmation:form.get('confirmation')});
  if (!parsed.success) return {message:'Revisa la contraseña.',errors:parsed.error.flatten().fieldErrors};
  try {
    const client=await createClient();
    const {error}=await client.auth.updateUser({password:parsed.data.password});
    if (error) return {message:'No se pudo guardar. Usa una contraseña diferente de al menos 12 caracteres y revisa los requisitos de seguridad de tu cuenta.'};
  } catch {return {message:'No pudimos confirmar el cambio. Comprueba tu conexión e intenta nuevamente.'};}
  revalidatePath('/','layout');
  redirect(homeForRole(profile.role));
}

````

## app/cuenta/crear-clave/page.tsx

````tsx
import type {Metadata} from 'next';
import {requireAccess} from '../../../lib/auth/authorization';
import {PasswordForm} from './password-form';
import s from '../../admin/eventos/events.module.css';
import styles from '../../admin/usuarios/users.module.css';
export const metadata:Metadata={title:'Crea tu contraseña | RoboScore',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page() {
  const profile=await requireAccess();
  return <div className={s.screen}><main className={s.main}><div className={styles.narrow}><section className={s.card}><header className={s.title}><p>BIENVENIDO A ROBOSCORE</p><h1>Crea tu contraseña.</h1><span>Tu cuenta: {profile.email}</span></header><PasswordForm/></section></div></main></div>;
}

````

## app/cuenta/crear-clave/password-form.tsx

````tsx
'use client';
import {useActionState,useEffect,useRef} from 'react';
import {savePassword} from './actions';
import type {PasswordState} from '../../../lib/users/password';
import s from '../../admin/eventos/events.module.css';
export function PasswordForm() {
  const [state,action,pending]=useActionState<PasswordState,FormData>(savePassword,{});
  const notice=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(state.message)notice.current?.focus();},[state]);
  return <form action={action} noValidate aria-busy={pending}>
    {state.message&&<div ref={notice} tabIndex={-1} role="alert" className={s.error}>{state.message}</div>}
    <fieldset disabled={pending} className={s.formFields}>
      {(['password','confirmation'] as const).map(field=><div className={s.field} key={field}><label htmlFor={field}>{field==='password'?'Tu nueva contraseña':'Repite la contraseña'}</label><input type="password" id={field} name={field} autoComplete="new-password" required minLength={12} maxLength={128} aria-invalid={Boolean(state.errors?.[field])} aria-describedby={state.errors?.[field]?`${field}-error`:undefined}/>{state.errors?.[field]&&<p id={`${field}-error`} className={s.fieldError}>{state.errors[field]?.[0]}</p>}</div>)}
      <p className={s.muted}>Usa al menos 12 caracteres. Una frase de varias palabras es fácil de recordar.</p><button className={s.primary} disabled={pending}>{pending?'Guardando…':'Guardar contraseña y entrar'}</button>
    </fieldset>
  </form>;
}

````

## lib/users/access.ts

````ts
import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAccess } from '../auth/authorization';
import { createClient } from '../supabase/server';
import type { ManagedUser } from './schema';
export const userColumns = 'id,first_name,last_name,email,phone,role,active,managed_by,created_at,updated_at';
export async function requireUserManager(superOnly = false) {
  const actor = await requireAccess('admin');
  if (superOnly && actor.role !== 'SUPER_ADMIN') redirect('/admin?aviso=permisos');
  return actor;
}
export async function readManagedUser(id: string) {
  const actor = await requireUserManager();
  if (!z.string().uuid().safeParse(id).success) notFound();
  const client = await createClient();
  const { data,error } = await client.from('profiles').select(userColumns).eq('id',id).maybeSingle<ManagedUser>();
  if (error) throw new Error('No se pudo consultar la cuenta.');
  if (!data || (actor.role !== 'SUPER_ADMIN' && (data.role !== 'JUDGE' || data.managed_by !== actor.id))) notFound();
  return { actor,user:data };
}

````

## lib/users/password.ts

````ts
import {z} from 'zod';
export const passwordSchema=z.object({
  password:z.string().min(12,'Usa al menos 12 caracteres.').max(128,'Usa como máximo 128 caracteres.'),
  confirmation:z.string(),
}).refine(value=>value.password===value.confirmation,{path:['confirmation'],message:'Las contraseñas no coinciden.'});
export type PasswordState={message?:string;errors?:{password?:string[];confirmation?:string[]}};

````

## lib/users/schema.ts

````ts
import { z } from 'zod';
export const roleLabels = { SUPER_ADMIN: 'Superadministrador', ADMIN: 'Administrador', JUDGE: 'Juez' };
export const userFields = z.object({
  first_name: z.string().trim().min(1,'Escribe el nombre.').max(100,'Usa como máximo 100 caracteres.'),
  last_name: z.string().trim().min(1,'Escribe el apellido.').max(150,'Usa como máximo 150 caracteres.'),
  phone: z.string().trim().max(40,'Usa como máximo 40 caracteres.'),
  role: z.enum(['ADMIN','JUDGE']),
});
export const inviteSchema = userFields.extend({ email: z.string().trim().toLowerCase().email('Escribe un correo válido.').max(254,'El correo es demasiado largo.') });
export const editUserSchema = userFields.extend({ active: z.enum(['true','false']) });
export type UserValues = { first_name: string; last_name: string; email: string; phone: string; role: string; active: string };
export type UserState = { message?: string; success?: boolean; errors?: Partial<Record<keyof UserValues,string[]>>; values?: UserValues };
export type ManagedUser = { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; role: keyof typeof roleLabels; active: boolean; managed_by: string | null; created_at: string; updated_at: string };
export const blankUser: UserValues = { first_name:'',last_name:'',email:'',phone:'',role:'JUDGE',active:'true' };
export function userValues(user: ManagedUser): UserValues {
  return { first_name:user.first_name,last_name:user.last_name,email:user.email ?? '',phone:user.phone ?? '',role:user.role,active:String(user.active) };
}

````

## lib/supabase/admin.ts

````ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { authConfig, authFetch } from '../auth/config';
export function invitationConfig() {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const site = process.env.ROBOSCORE_SITE_URL;
  if (!secret || !site) throw new Error('Falta configurar el servicio de invitaciones.');
  const url = new URL(site);
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '') ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname)))) {
    throw new Error('La dirección de RoboScore no es válida.');
  }
  return { secret, redirectTo: `${url.origin}/auth/invitacion` };
}
export function invitationsReady() {
  try { invitationConfig(); return true; } catch { return false; }
}
// No reutiliza cookies ni sesiones. Este cliente solo se utiliza para Auth Admin.
export function createAdminClient() {
  const { url } = authConfig();
  const { secret } = invitationConfig();
  return createClient(url,secret,{ auth:{ persistSession:false,autoRefreshToken:false,detectSessionInUrl:false },global:{ fetch:authFetch } });
}

````

## supabase/migrations/202609200004_user_management.sql

````sql
-- FASE 11. Repetible; requiere perfiles (fase 4) y permisos de eventos (fase 9).
-- No envía correos, no cambia cuentas existentes y no desactiva RLS.
BEGIN;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS managed_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS profiles_manager_role_idx ON public.profiles(managed_by,role);

CREATE TABLE IF NOT EXISTS roboscore_private.user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  role public.user_role NOT NULL CHECK (role IN ('ADMIN','JUDGE')),
  invited_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  user_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  last_attempt_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE roboscore_private.user_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON roboscore_private.user_invitations FROM PUBLIC,anon,authenticated;

DROP POLICY IF EXISTS profiles_read_managed_judges ON public.profiles;
CREATE POLICY profiles_read_managed_judges ON public.profiles FOR SELECT TO authenticated
USING (role='JUDGE' AND managed_by=(SELECT auth.uid()) AND (SELECT roboscore_private.is_event_admin()));
-- Conserva las políticas de lectura propia y del superadministrador de la fase 4.
-- Sin INSERT/UPDATE/DELETE directo: los cambios pasan por funciones controladas.

CREATE OR REPLACE FUNCTION public.roboscore_prepare_user_invitation(
  p_email text,p_first_name text,p_last_name text,p_phone text,p_role public.user_role
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  invitation roboscore_private.user_invitations%ROWTYPE;
  normalized_email text := lower(btrim(p_email));
BEGIN
  SELECT * INTO actor FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
  IF NOT FOUND OR NOT actor.active OR actor.role NOT IN ('SUPER_ADMIN','ADMIN') THEN
    RAISE EXCEPTION 'No tienes permisos.' USING ERRCODE='42501';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('ADMIN','JUDGE') OR (p_role='ADMIN' AND actor.role<>'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Solo el superadministrador puede invitar administradores.' USING ERRCODE='42501';
  END IF;
  IF normalized_email IS NULL OR length(normalized_email)>254 OR normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR coalesce(length(btrim(p_first_name)),0) NOT BETWEEN 1 AND 100
    OR coalesce(length(btrim(p_last_name)),0) NOT BETWEEN 1 AND 150
    OR coalesce(length(p_phone),0)>40 THEN
    RAISE EXCEPTION 'Datos de invitación no válidos.' USING ERRCODE='22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(normalized_email,0));
  SELECT * INTO invitation FROM roboscore_private.user_invitations WHERE email=normalized_email FOR UPDATE;
  IF FOUND THEN
    IF invitation.invited_by<>actor.id AND actor.role<>'SUPER_ADMIN' THEN
      RAISE EXCEPTION 'El correo ya está en uso o no puede invitarse desde esta cuenta.' USING ERRCODE='42501';
    END IF;
    IF invitation.role<>p_role THEN
      RAISE EXCEPTION 'Ya existe una invitación con otro rol. Revisa la ficha del usuario.' USING ERRCODE='22023';
    END IF;
    IF invitation.user_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM auth.users u JOIN public.profiles p ON p.id=u.id
      WHERE u.id=invitation.user_id AND lower(u.email)=normalized_email
        AND u.email_confirmed_at IS NULL AND p.active AND p.role=invitation.role
    ) THEN
      RAISE EXCEPTION 'La cuenta ya existe. Gestiona sus datos desde el listado.' USING ERRCODE='23505';
    END IF;
    IF invitation.last_attempt_at>now()-interval '60 seconds' THEN
      RAISE EXCEPTION 'Espera un minuto antes de volver a enviar la invitación.' USING ERRCODE='P0001';
    END IF;
    UPDATE roboscore_private.user_invitations SET last_attempt_at=now(),expires_at=now()+interval '15 minutes'
      WHERE id=invitation.id;
    RETURN invitation.id;
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email)=normalized_email) THEN
    RAISE EXCEPTION 'El correo ya está en uso. Revisa el listado de usuarios.' USING ERRCODE='23505';
  END IF;
  IF (SELECT count(*) FROM roboscore_private.user_invitations WHERE invited_by=actor.id AND last_attempt_at>now()-interval '1 hour')>=20 THEN
    RAISE EXCEPTION 'Alcanzaste el límite de invitaciones. Intenta más tarde.' USING ERRCODE='P0001';
  END IF;
  INSERT INTO roboscore_private.user_invitations(email,first_name,last_name,phone,role,invited_by,expires_at)
    VALUES(normalized_email,btrim(p_first_name),btrim(p_last_name),nullif(btrim(p_phone),''),p_role,actor.id,now()+interval '15 minutes')
    RETURNING id INTO invitation.id;
  RETURN invitation.id;
END;
$$;
REVOKE ALL ON FUNCTION public.roboscore_prepare_user_invitation(text,text,text,text,public.user_role) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roboscore_prepare_user_invitation(text,text,text,text,public.user_role) TO authenticated;

-- Un rol nunca se obtiene de user_metadata. Solo de una reserva privada autorizada,
-- vinculada al correo y creada antes de llamar al servicio de invitaciones de Auth.
CREATE OR REPLACE FUNCTION roboscore_private.create_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE invitation roboscore_private.user_invitations%ROWTYPE;
BEGIN
  SELECT * INTO invitation FROM roboscore_private.user_invitations
    WHERE email=lower(NEW.email) AND user_id IS NULL AND expires_at>now()
      AND id::text=NEW.raw_user_meta_data->>'roboscore_invitation_id' FOR UPDATE;
  IF FOUND THEN
    PERFORM 1 FROM public.profiles WHERE id=invitation.invited_by AND active
      AND (role='SUPER_ADMIN' OR (role='ADMIN' AND invitation.role='JUDGE')) FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La invitación ya no está autorizada.' USING ERRCODE='42501'; END IF;
    INSERT INTO public.profiles(id,email,first_name,last_name,phone,role,active,managed_by)
      VALUES(NEW.id,NEW.email,invitation.first_name,invitation.last_name,invitation.phone,invitation.role,true,invitation.invited_by);
    UPDATE roboscore_private.user_invitations SET user_id=NEW.id WHERE id=invitation.id;
  ELSE
    INSERT INTO public.profiles(id,first_name,last_name,email)
      VALUES(NEW.id,left(coalesce(NEW.raw_user_meta_data->>'first_name',''),100),left(coalesce(NEW.raw_user_meta_data->>'last_name',''),150),NEW.email);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION roboscore_private.create_profile() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.roboscore_update_managed_user(
  p_id uuid,p_version timestamptz,p_first_name text,p_last_name text,p_phone text,p_role public.user_role,p_active boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.profiles%ROWTYPE; target public.profiles%ROWTYPE;
BEGIN
  -- Orden estable para serializar ediciones concurrentes y cambios de permisos.
  PERFORM id FROM public.profiles WHERE id IN (auth.uid(),p_id) ORDER BY id FOR UPDATE;
  SELECT * INTO actor FROM public.profiles WHERE id=auth.uid();
  IF NOT FOUND OR NOT actor.active OR actor.role NOT IN ('SUPER_ADMIN','ADMIN') THEN
    RAISE EXCEPTION 'No tienes permisos.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO target FROM public.profiles WHERE id=p_id;
  IF NOT FOUND OR target.id=actor.id OR target.role='SUPER_ADMIN'
    OR (actor.role='ADMIN' AND (target.role<>'JUDGE' OR target.managed_by IS DISTINCT FROM actor.id OR p_role IS DISTINCT FROM 'JUDGE'::public.user_role))
    OR p_role IS NULL OR p_role NOT IN ('ADMIN','JUDGE') THEN
    RAISE EXCEPTION 'No puedes modificar esta cuenta.' USING ERRCODE='42501';
  END IF;
  IF p_version IS DISTINCT FROM target.updated_at THEN
    RAISE EXCEPTION 'La cuenta cambió en otra sesión. Recarga antes de guardar.' USING ERRCODE='40001';
  END IF;
  IF coalesce(length(btrim(p_first_name)),0) NOT BETWEEN 1 AND 100
    OR coalesce(length(btrim(p_last_name)),0) NOT BETWEEN 1 AND 150
    OR coalesce(length(p_phone),0)>40 OR p_active IS NULL THEN
    RAISE EXCEPTION 'Datos de usuario no válidos.' USING ERRCODE='22023';
  END IF;
  UPDATE public.profiles SET first_name=btrim(p_first_name),last_name=btrim(p_last_name),phone=nullif(btrim(p_phone),''),role=p_role,active=p_active WHERE id=p_id;
  RETURN p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.roboscore_update_managed_user(uuid,timestamptz,text,text,text,public.user_role,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roboscore_update_managed_user(uuid,timestamptz,text,text,text,public.user_role,boolean) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

````

## supabase/verify-phase-11.sql

````sql
SELECT '01. Perfiles con RLS' AS check_name,relrowsecurity AS passed FROM pg_class WHERE oid='public.profiles'::regclass
UNION ALL
SELECT '02. Responsable de la cuenta',EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='managed_by')
UNION ALL
SELECT '03. Lectura de jueces propios',EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_read_managed_judges')
UNION ALL
SELECT '04. Sin escritura directa de perfiles',NOT has_any_column_privilege('authenticated','public.profiles','INSERT') AND NOT has_any_column_privilege('authenticated','public.profiles','UPDATE') AND NOT has_table_privilege('authenticated','public.profiles','DELETE')
UNION ALL
SELECT '05. Invitaciones privadas con RLS',relrowsecurity AND NOT has_table_privilege('anon','roboscore_private.user_invitations','SELECT') AND NOT has_table_privilege('authenticated','roboscore_private.user_invitations','SELECT') FROM pg_class WHERE oid='roboscore_private.user_invitations'::regclass
UNION ALL
SELECT '06. Preparación limitada a sesiones autenticadas',has_function_privilege('authenticated','public.roboscore_prepare_user_invitation(text,text,text,text,public.user_role)','EXECUTE') AND NOT has_function_privilege('anon','public.roboscore_prepare_user_invitation(text,text,text,text,public.user_role)','EXECUTE')
UNION ALL
SELECT '07. Edición limitada a sesiones autenticadas',has_function_privilege('authenticated','public.roboscore_update_managed_user(uuid,timestamptz,text,text,text,public.user_role,boolean)','EXECUTE') AND NOT has_function_privilege('anon','public.roboscore_update_managed_user(uuid,timestamptz,text,text,text,public.user_role,boolean)','EXECUTE')
UNION ALL
SELECT '08. Funciones con search_path fijo',count(*)=3 AND bool_and(prosecdef AND coalesce(array_to_string(proconfig,',') LIKE '%search_path=%',false)) FROM pg_proc WHERE oid IN ('public.roboscore_prepare_user_invitation(text,text,text,text,public.user_role)'::regprocedure,'public.roboscore_update_managed_user(uuid,timestamptz,text,text,text,public.user_role,boolean)'::regprocedure,'roboscore_private.create_profile()'::regprocedure)
ORDER BY check_name;

````

## supabase/email-templates/invite-user.html

````html
<h2>Te damos la bienvenida a RoboScore</h2>
<p>Tu organizador te invitó a formar parte de su equipo.</p>
<p>Abre el enlace para aceptar la invitación y crear tu contraseña personal.</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}">Aceptar invitación</a></p>
<p>Si no esperabas esta invitación, puedes ignorar este correo.</p>

````

## tests/user-permissions.mjs

````mjs
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const db=new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
  CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb,email_confirmed_at timestamptz,invited_at timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO authenticated; GRANT USAGE ON SCHEMA public TO anon;`);
for(const file of ['tests/fixtures/foundation.sql','supabase/migrations/202609160001_profiles_roles.sql','supabase/migrations/202609200002_event_management.sql','supabase/migrations/202609200004_user_management.sql','supabase/migrations/202609200004_user_management.sql']) await db.exec(await fs.readFile(root+file,'utf8'));
const ids=Array.from({length:9},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
for(let i=0;i<5;i++) {
  await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data,email_confirmed_at) VALUES($1,$2,$3,now())',[ids[i],`user${i}@example.test`,{}]);
  await db.query('UPDATE profiles SET role=$1,active=$2 WHERE id=$3',[i===0?'SUPER_ADMIN':i===3?'JUDGE':'ADMIN',i!==4,ids[i]]);
}
async function asUser(id,role='authenticated') {await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE '+role);}
async function reserve(email,role='JUDGE') {return (await db.query('SELECT roboscore_prepare_user_invitation($1,$2,$3,$4,$5) AS id',[email,'Ana','Prueba','',role])).rows[0].id;}
async function version(id) {return (await db.query('SELECT updated_at::text AS version FROM profiles WHERE id=$1',[id])).rows[0].version;}
async function edit(id,role='JUDGE',active=true,v) {return db.query('SELECT roboscore_update_managed_user($1,$2,$3,$4,$5,$6,$7) AS id',[id,v??await version(id),'Ana','Actualizada','123',role,active]);}
let checks=0;const pass=name=>{checks++;console.log('PASS '+name);};
await asUser(ids[1]);
await assert.rejects(reserve('admin@example.test','ADMIN'),{code:'42501'});
await assert.rejects(reserve('super@example.test','SUPER_ADMIN'),{code:'42501'});
await assert.rejects(db.query("UPDATE profiles SET role='SUPER_ADMIN' WHERE id=$1",[ids[1]]),{code:'42501'});
pass('Admin cannot promote, invite admin/superadmin or write profiles directly');
const invitation=await reserve('  JUDGE@example.test ');
await assert.rejects(reserve('judge@example.test'),{code:'P0001'});
await assert.rejects(reserve('user0@example.test'),{code:'23505'});
pass('Normalized email, duplicate account and invitation cooldown');
await asUser(ids[2]);
await assert.rejects(reserve('judge@example.test'),{code:'42501'});
pass('Another administrator cannot take over a pending invitation');
await db.exec('RESET ROLE');
// Auth inserts the user before sendInvite updates invited_at. Match that sequence.
await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[ids[5],'judge@example.test',{roboscore_invitation_id:invitation,role:'SUPER_ADMIN',active:false}]);
let judge=(await db.query('SELECT * FROM profiles WHERE id=$1',[ids[5]])).rows[0];
assert.equal(judge.role,'JUDGE');assert.equal(judge.active,true);assert.equal(judge.managed_by,ids[1]);assert.equal(judge.first_name,'Ana');
pass('Auth trigger uses authorized reservation; ignores metadata role and active');
await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[ids[6],'impostor@example.test',{roboscore_invitation_id:invitation,role:'SUPER_ADMIN',active:true}]);
let impostor=(await db.query('SELECT * FROM profiles WHERE id=$1',[ids[6]])).rows[0];
assert.equal(impostor.role,'JUDGE');assert.equal(impostor.active,false);assert.equal(impostor.managed_by,null);
pass('Wrong email or reused invitation cannot grant privileges');
await asUser(ids[1]);
assert.deepEqual((await db.query('SELECT id FROM profiles ORDER BY id')).rows.map(r=>r.id),[ids[1],ids[5]]);
await asUser(ids[2]);
assert.equal((await db.query('SELECT id FROM profiles WHERE id=$1',[ids[5]])).rows.length,0);
await assert.rejects(edit(ids[5],'JUDGE',true,judge.updated_at),{code:'42501'});
pass('Managers can read/edit only their own judges');
await asUser(ids[1]);
const stale=await version(ids[5]);
await edit(ids[5],'JUDGE',false,stale);
await assert.rejects(edit(ids[5],'JUDGE',true,stale),{code:'40001'});
await edit(ids[5]);
pass('Deactivate/reactivate preserves data and stale updates are rejected');
await asUser(ids[0]);
await assert.rejects(edit(ids[0],'ADMIN',false),{code:'42501'});
await assert.rejects(edit(ids[5],'SUPER_ADMIN',true),{code:'42501'});
await edit(ids[5],'ADMIN');
await asUser(ids[1]);
assert.equal((await db.query('SELECT id FROM profiles WHERE id=$1',[ids[5]])).rows.length,0);
await assert.rejects(edit(ids[5],'JUDGE',true,new Date().toISOString()),{code:'42501'});
pass('Superadmin protected; only superadmin can promote; old manager loses access');
await asUser(ids[0]);
const invitationAdmin=await reserve('newadmin@example.test','ADMIN');
await db.exec('RESET ROLE');
await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[ids[7],'newadmin@example.test',{roboscore_invitation_id:invitationAdmin}]);
assert.equal((await db.query('SELECT role FROM profiles WHERE id=$1',[ids[7]])).rows[0].role,'ADMIN');
pass('Superadmin invitation creates an administrator atomically');
for(const i of [3,4]) {
  await asUser(ids[i]);
  await assert.rejects(reserve(`blocked${i}@example.test`),{code:'42501'});
  await assert.rejects(edit(ids[5],'JUDGE',false,new Date().toISOString()),{code:'42501'});
}
await asUser('','anon');
await assert.rejects(reserve('anon@example.test'),{code:'42501'});
await assert.rejects(db.query('SELECT * FROM profiles'),{code:'42501'});
pass('Judge, inactive administrator and visitor cannot manage accounts');
await asUser(ids[2]);
const withdrawn=await reserve('withdrawn@example.test');
await db.exec('RESET ROLE');await db.query('UPDATE profiles SET active=false WHERE id=$1',[ids[2]]);
await assert.rejects(db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[ids[8],'withdrawn@example.test',{roboscore_invitation_id:withdrawn}]),{code:'42501'});
pass('Deactivation before Auth creation invalidates pending authorization');
await db.query("UPDATE roboscore_private.user_invitations SET last_attempt_at=now()-interval '2 minutes' WHERE id=$1",[invitationAdmin]);
await asUser(ids[0]);assert.equal(await reserve('newadmin@example.test','ADMIN'),invitationAdmin);
await db.exec('RESET ROLE');await db.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1',[ids[7]]);
await db.query("UPDATE roboscore_private.user_invitations SET last_attempt_at=now()-interval '2 minutes' WHERE id=$1",[invitationAdmin]);
await asUser(ids[0]);await assert.rejects(reserve('newadmin@example.test','ADMIN'),{code:'23505'});
pass('Pending invitation can retry; confirmed account cannot be reinvited');
await assert.rejects(db.query('SELECT * FROM roboscore_private.user_invitations'),{code:'42501'});
await assert.rejects(db.query('DELETE FROM profiles'),{code:'42501'});
pass('Invitation data private and permanent profile deletion denied');
await db.exec('RESET ROLE');
const verification=(await db.query(await fs.readFile(root+'supabase/verify-phase-11.sql','utf8'))).rows;
assert.equal(verification.length,8);assert(verification.every(row=>row.passed));
pass('Migration repeatable and eight deployment checks pass');
await db.close();console.log(`${checks} PostgreSQL checks passed. No Supabase connection or email sent.`);

````

## tests/user-actions.test.cjs

````cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function load(file,dependencies={}){
  const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,require:n=>n in dependencies?dependencies[n]:require(n),Date});
  return module.exports;
}
const profileId='00000000-0000-4000-8000-000000000001';

// ---------- app/auth/invitacion/actions.ts ----------
function acceptFixture(){
  const state={verify:{data:{user:{id:profileId}},error:null},profileRow:{data:{active:true},error:null},signedOut:0};
  const client={
    auth:{
      verifyOtp:async()=>state.verify,
      signOut:async arg=>{assert.equal(arg.scope,'local');state.signedOut++;},
    },
    from(table){assert.equal(table,'profiles');return {select:col=>{assert.equal(col,'active');return {eq:(key,id)=>{assert.equal(key,'id');assert.equal(id,profileId);return {single:async()=>state.profileRow};}};}};},
  };
  const action=load('app/auth/invitacion/actions.ts',{
    'next/navigation':{redirect:url=>{throw Error('REDIRECT '+url);}},
    '../../../lib/supabase/server':{createClient:async remember=>{assert.equal(remember,false);if(state.throwOnClient)throw Error('offline');return client;}},
  });
  return {state,accept:token=>action.acceptInvitation(token,{})};
}
const validToken='a'.repeat(40);
test('Invitation link with an invalid shape is rejected before touching Supabase',async()=>{
  const f=acceptFixture();
  const result=await f.accept('not-a-token');
  assert.match(result.message,/enlace no es válido/);
});
test('Expired or already-used invitation link shows a recoverable message',async()=>{
  const f=acceptFixture();f.state.verify={data:{user:null},error:{message:'expired'}};
  const result=await f.accept(validToken);
  assert.match(result.message,/venció o ya fue utilizado/);
});
test('Verified but inactive/missing profile signs the session out locally',async()=>{
  const f=acceptFixture();f.state.profileRow={data:{active:false},error:null};
  const result=await f.accept(validToken);
  assert.match(result.message,/no está habilitada/);assert.equal(f.state.signedOut,1);
});
test('Profile lookup failure also denies and signs out',async()=>{
  const f=acceptFixture();f.state.profileRow={data:null,error:{message:'db'}};
  const result=await f.accept(validToken);
  assert.match(result.message,/no está habilitada/);assert.equal(f.state.signedOut,1);
});
test('Valid invitation redirects to create a password',async()=>{
  const f=acceptFixture();
  await assert.rejects(f.accept(validToken),{message:'REDIRECT /cuenta/crear-clave'});
  assert.equal(f.state.signedOut,0);
});
test('Connection failure during verification is reported without leaking detail',async()=>{
  const f=acceptFixture();f.state.throwOnClient=true;
  const result=await f.accept(validToken);
  assert.match(result.message,/No pudimos confirmar el acceso/);
});

// ---------- app/cuenta/crear-clave/actions.ts ----------
function passwordFixture(role='JUDGE'){
  const state={updateError:null,revalidated:0,denied:false};
  const action=load('app/cuenta/crear-clave/actions.ts',{
    '../../../lib/auth/authorization':{requireAccess:async()=>{if(state.denied)throw Error('DENIED');return {id:profileId,role};},homeForRole:r=>r==='JUDGE'?'/judge':'/admin'},
    '../../../lib/supabase/server':{createClient:async()=>({auth:{updateUser:async arg=>{state.password=arg.password;return {error:state.updateError};}}})},
    '../../../lib/users/password':load('lib/users/password.ts'),
    'next/navigation':{redirect:url=>{throw Error('REDIRECT '+url);}},
    'next/cache':{revalidatePath:()=>{state.revalidated++;}},
  });
  return {state,save:form=>action.savePassword({},form)};
}
function passwordForm(password,confirmation=password){const f=new FormData();f.set('password',password);f.set('confirmation',confirmation);return f;}
test('Short password is rejected before calling Supabase',async()=>{
  const f=passwordFixture();
  const result=await f.save(passwordForm('short'));
  assert(result.errors.password);
});
test('Mismatched confirmation is rejected',async()=>{
  const f=passwordFixture();
  const result=await f.save(passwordForm('una-frase-larga-1','otra-frase-larga-1'));
  assert(result.errors.confirmation);
});
test('Supabase rejecting the new password surfaces a guidance message',async()=>{
  const f=passwordFixture();f.state.updateError={message:'weak'};
  const result=await f.save(passwordForm('una-frase-bien-larga'));
  assert.match(result.message,/No se pudo guardar/);
});
test('Saved password redirects a judge to /judge and an admin to /admin',async()=>{
  const judge=passwordFixture('JUDGE');
  await assert.rejects(judge.save(passwordForm('una-frase-bien-larga')),{message:'REDIRECT /judge'});
  assert.equal(judge.state.revalidated,1);assert.equal(judge.state.password,'una-frase-bien-larga');
  const admin=passwordFixture('ADMIN');
  await assert.rejects(admin.save(passwordForm('una-frase-bien-larga')),{message:'REDIRECT /admin'});
});
test('Session no longer valid when saving denies access',async()=>{
  const f=passwordFixture();f.state.denied=true;
  await assert.rejects(f.save(passwordForm('una-frase-bien-larga')),{message:'DENIED'});
});

// ---------- app/admin/usuarios/actions.ts ----------
const schema=load('lib/users/schema.ts');
function userFixture({actorRole='SUPER_ADMIN',ready=true}={}){
  const state={rpc:{data:'00000000-0000-4000-8000-0000000000aa',error:null},invite:{error:null},update:{data:null,error:null},refreshed:0,inviteCalls:0};
  const action=load('app/admin/usuarios/actions.ts',{
    zod:require('zod'),
    'next/navigation':{redirect:url=>{throw Error('REDIRECT '+url);}},
    'next/cache':{revalidatePath:()=>{state.refreshed++;}},
    '../../../lib/users/access':{requireUserManager:async()=>({id:'00000000-0000-4000-8000-000000000009',role:actorRole})},
    '../../../lib/users/schema':schema,
    '../../../lib/supabase/server':{createClient:async()=>({rpc:async(name,args)=>{assert.equal(name,'roboscore_prepare_user_invitation');state.rpcArgs=args;return state.rpc;}})},
    '../../../lib/supabase/admin':{
      invitationConfig:()=>{if(!ready)throw Error('not configured');return {redirectTo:'https://roboscore.test/auth/invitacion'};},
      createAdminClient:()=>({auth:{admin:{inviteUserByEmail:async(email,opts)=>{state.inviteCalls++;state.inviteArgs={email,opts};return state.invite;}}}}),
    },
  });
  return {state,invite:form=>action.inviteUser({},form)};
}
function inviteForm(overrides={}){const values={first_name:'Ana',last_name:'Prueba',email:'ana@example.test',phone:'',role:'JUDGE',active:'true',...overrides};const f=new FormData();Object.entries(values).forEach(([k,v])=>f.set(k,v));return f;}
test('Administrator cannot invite another administrator',async()=>{
  const f=userFixture({actorRole:'ADMIN'});
  const result=await f.invite(inviteForm({role:'ADMIN'}));
  assert.match(result.message,/Solo el superadministrador/);assert.equal(f.state.inviteCalls,0);
});
test('Missing server configuration is reported before touching the database',async()=>{
  const f=userFixture({ready:false});
  const result=await f.invite(inviteForm());
  assert.match(result.message,/fase 11/);assert.equal(f.state.inviteCalls,0);
});
test('Invalid fields never reach Supabase',async()=>{
  const f=userFixture();
  const result=await f.invite(inviteForm({email:'not-an-email'}));
  assert(result.errors.email);assert.equal(f.state.inviteCalls,0);
});
test('Database rejection is translated into a message',async()=>{
  const f=userFixture();f.state.rpc={data:null,error:{code:'23505',message:'El correo ya está en uso.'}};
  const result=await f.invite(inviteForm());
  assert.equal(result.message,'El correo ya está en uso.');assert.equal(f.state.inviteCalls,0);
});
test('Supabase rate limiting the invite email is reported distinctly',async()=>{
  const f=userFixture();f.state.invite={error:{status:429}};
  const result=await f.invite(inviteForm());
  assert.match(result.message,/limitó los envíos/);
});
test('Successful invitation reaches Auth with the reservation id and refreshes listings',async()=>{
  const f=userFixture();
  const result=await f.invite(inviteForm());
  assert.equal(result.success,true);
  assert.equal(f.state.inviteArgs.email,'ana@example.test');
  assert.equal(f.state.inviteArgs.opts.redirectTo,'https://roboscore.test/auth/invitacion');
  assert.equal(f.state.inviteArgs.opts.data.roboscore_invitation_id,f.state.rpc.data);
  assert(f.state.refreshed>0);
});
test('An account cannot edit itself',async()=>{
  const actorId='00000000-0000-4000-8000-000000000009';
  const action=load('app/admin/usuarios/actions.ts',{
    zod:require('zod'),
    'next/navigation':{redirect:url=>{throw Error('REDIRECT '+url);}},
    'next/cache':{revalidatePath:()=>{}},
    '../../../lib/users/access':{requireUserManager:async()=>({id:actorId,role:'SUPER_ADMIN'})},
    '../../../lib/users/schema':schema,
    '../../../lib/supabase/server':{createClient:async()=>({rpc:async()=>({data:actorId,error:null})})},
    '../../../lib/supabase/admin':{invitationConfig:()=>({redirectTo:'https://roboscore.test/auth/invitacion'}),createAdminClient:()=>({})},
  });
  const form=inviteForm({active:'true'});
  const result=await action.updateUser(actorId,'2026-09-20T12:00:00.000Z',{},form);
  assert.match(result.message,/No puedes modificar esta cuenta/);
});

````
