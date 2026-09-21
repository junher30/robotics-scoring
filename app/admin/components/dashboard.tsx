import Link from 'next/link';
import { Brand } from '../../components/brand';
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
      <Link href="/" className={styles.brand}><Brand/></Link>
      <p className={styles.navLabel}>TU ESPACIO</p>
      <nav><Link href="/admin" aria-current="page" className={styles.selected}>▦ <span>Resumen</span></Link><Link href="/admin/eventos">◈ <span>Eventos</span></Link><Link href="/admin/jueces">◇ <span>Jueces</span></Link>{profile.role==='SUPER_ADMIN'&&<Link href="/admin/usuarios">◎ <span>Usuarios</span></Link>}<Link href="/cuenta">◎ <span>Mi cuenta</span></Link><Link href="/">↗ <span>Ver sitio público</span></Link></nav>
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
