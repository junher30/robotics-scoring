import Link from 'next/link';
import { requireUserManager,userColumns } from '../../../lib/users/access';
import { createClient } from '../../../lib/supabase/server';
import { roleLabels,type ManagedUser } from '../../../lib/users/schema';
import { UserShell } from './shell';
import s from '../eventos/events.module.css';
import styles from './users.module.css';
export type DirectoryQuery = {rol?:string;estado?:string;pagina?:string;resultado?:string};
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
    let request = client.from('profiles').select(userColumns,{count:'exact'}).is('deleted_at',null).order('created_at',{ascending:false}).order('id').range((page-1)*20,page*20-1);
    if (role) request=request.eq('role',role);
    if (active) request=request.eq('active',active==='true');
    if (!superAdmin) request=request.eq('managed_by',actor.id);
    const result = await request.returns<ManagedUser[]>();
    failed=Boolean(result.error); rows=result.data??[]; count=result.count??0;
  } catch {failed=true;}
  const pageUrl=(value:number)=>`${base}?${new URLSearchParams({...(role ? {rol:role}:{}),...(active ? {estado:active}:{}),pagina:String(value)})}`;
  const inviteUrl=kind==='judges' ? '/admin/jueces/nuevo' : `/admin/usuarios/nuevo${kind==='admins' ? '?rol=ADMIN':''}`;
  return <UserShell superAdmin={superAdmin}>
    {query.resultado==='eliminado'&&<p className={s.success} role="status">Juez eliminado del listado. Su acceso quedó bloqueado y su historial se conserva.</p>}
    <div className={s.titleRow}><header className={s.title}><p>LAS PERSONAS DETRÁS DE CADA RETO</p><h1>{title}<span aria-hidden="true">.</span></h1><span>{kind==='judges' ? 'Prepara el equipo que acompañará y evaluará la competencia.' : 'Organiza los accesos y acompaña a tu equipo de trabajo.'}</span></header><Link href={inviteUrl} className={s.primary}>+ {kind==='judges'?'Invitar juez':kind==='admins'?'Invitar administrador':'Invitar usuario'}</Link></div>
    {superAdmin && <nav className={styles.directoryTabs} aria-label="Tipos de usuario"><Link href="/admin/usuarios" aria-current={kind==='all'?'page':undefined}>Todos los usuarios</Link><Link href="/admin/administradores" aria-current={kind==='admins'?'page':undefined}>Administradores</Link><Link href="/admin/jueces" aria-current={kind==='judges'?'page':undefined}>Jueces</Link></nav>}
    <form method="get" className={s.filters}>{kind==='all' && <><label htmlFor="rol">Rol</label><select id="rol" name="rol" defaultValue={role??''}><option value="">Todos</option>{Object.entries(roleLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></>}<label htmlFor="estado">Estado</label><select id="estado" name="estado" defaultValue={active??''}><option value="">Todos</option><option value="true">Activos</option><option value="false">Desactivados</option></select><button className={s.secondary}>Filtrar</button><Link href={base} className={s.textLink}>Limpiar</Link></form>
    {failed ? <div className={s.error} role="alert">No pudimos cargar las cuentas. Revisa la conexión y la configuración de usuarios. <Link href={base}>Reintentar</Link></div> : <><p className={s.muted}>{count} {count===1?'cuenta':'cuentas'} · Página {page}{!superAdmin?' · Solo los jueces que has invitado':''}</p>
    {rows.length===0 ? <section className={s.empty}><span aria-hidden="true">◎</span><h2>{active||page>1?'No hay cuentas en esta vista':'Un gran evento empieza con su equipo'}</h2><p>{active||page>1?'Cambia el filtro para consultar otras cuentas.':'Envía una invitación. Cada persona creará su propia contraseña desde su correo.'}</p><Link href={active||page>1?base:inviteUrl} className={s.primary}>{active||page>1?'Ver todas':'Enviar una invitación'}</Link></section> : <div className={s.list}>{rows.map(user=><article className={s.event} key={user.id}><div className={styles.person}><span className={styles.avatar} aria-hidden="true">{(user.first_name||user.email||'U').slice(0,1).toUpperCase()}</span><div className={styles.personInfo}><h2><Link href={`/admin/usuarios/${user.id}`}>{[user.first_name,user.last_name].filter(Boolean).join(' ')||'Cuenta sin nombre'}</Link></h2><p>{user.email||'Correo no disponible'}</p><p>Creada el {new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',dateStyle:'medium'}).format(new Date(user.created_at))}</p><div className={styles.badges}><span className={s.badge}>{roleLabels[user.role]}</span><span className={`${styles.state} ${!user.active?styles.inactive:''}`}>{user.active?'Activa':'Desactivada'}</span></div></div></div><Link className={s.secondary} href={`/admin/usuarios/${user.id}`}>Ver cuenta →</Link></article>)}</div>}
    <nav className={s.pagination} aria-label="Páginas de usuarios">{page>1&&<Link className={s.secondary} href={pageUrl(page-1)}>← Anterior</Link>}{page*20<count&&<Link className={s.secondary} href={pageUrl(page+1)}>Siguiente →</Link>}</nav></>}
  </UserShell>;
}
