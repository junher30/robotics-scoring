# Código completo — fase 8

## app/admin/page.tsx

```tsx
import type { Metadata } from 'next';
import { requireAccess } from '../../lib/auth/authorization';
import { readDashboard } from '../../lib/dashboard/read';
import { Dashboard } from './components/dashboard';
export const metadata: Metadata = { title: 'Administración | RoboScore', robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const profile = await requireAccess('admin');
  const [params, result] = await Promise.all([searchParams, readDashboard()]);
  return <Dashboard profile={profile} result={result} denied={params.aviso === 'permisos'}/>;
}

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
      <nav><Link href="/admin" aria-current="page" className={styles.selected}>▦ <span>Resumen</span></Link><Link href="/cuenta">◎ <span>Mi cuenta</span></Link><Link href="/">↗ <span>Ver sitio público</span></Link></nav>
      <div className={styles.sidebarNote}><span className={styles.spark}>✦</span><strong>Grandes ideas.<br/>Grandes competencias.</strong><p>Todo empieza con un equipo.</p></div>
      <div className={styles.user}><span className={styles.avatar}>{(profile.first_name || profile.email || 'R').slice(0,1).toUpperCase()}</span><div><strong>{profile.first_name || 'Mi cuenta'}</strong><small>{profile.role === 'SUPER_ADMIN' ? 'Superadministrador' : 'Administrador'}</small></div></div>
      <LogoutButton/>
    </aside>
    <main className={styles.main}>
      <header className={styles.topbar}><span>Administración <span aria-hidden="true">/</span> <strong>Resumen</strong></span><Link href="/admin" className={styles.refresh}>↻ Actualizar</Link></header>
      {denied && <p role="alert" className={styles.alert}>No tienes permisos para el área solicitada. Este es tu espacio de administración.</p>}
      <section className={styles.welcome}><div><p className={styles.eyebrow}>EL SIGUIENTE GRAN RETO EMPIEZA AQUÍ</p><h1>Bienvenido{profile.first_name ? `, ${profile.first_name}` : ''}<span>.</span></h1><p>Una vista clara de tus competencias y de quienes las hacen posibles.</p></div><div className={styles.create}><button disabled aria-describedby="create-help">+ Crear evento</button><small id="create-help">Disponible en la fase 9</small></div></section>
      {error && <div className={styles.alert} role="alert"><strong>{error === 'setup' ? 'Falta activar el resumen de datos.' : 'No pudimos cargar el resumen.'}</strong><p>{error === 'setup' ? 'El panel está preparado. El administrador debe completar la configuración de esta fase en Supabase.' : 'Actualiza la página para volver a intentarlo. Tus datos no se han modificado.'}</p><span>Las cifras se mostrarán cuando podamos consultarlas.</span></div>}
      <section aria-label="Cifras generales" className={styles.metrics}>{metrics.map(item=><article className={styles.metric} key={item.label}><div><span>{item.label}</span><span className={styles.metricIcon} aria-hidden="true">{item.icon}</span></div><strong aria-label={item.value === undefined ? 'No disponible' : undefined}>{item.value === undefined ? '—' : number.format(item.value)}</strong><p>{item.detail}</p></article>)}</section>
      <div className={styles.columns}><section className={styles.events}><div className={styles.sectionHead}><div><p className={styles.eyebrow}>EN EL CALENDARIO</p><h2>En curso y por venir</h2></div><span className={styles.pill}>Hasta 5 eventos</span></div>
        {!data ? <div className={styles.empty}><span aria-hidden="true">◷</span><h3>Tu agenda aparecerá aquí</h3><p>Estamos esperando la conexión con los datos de tus competencias.</p></div> : data.next_events.length === 0 ? <div className={styles.empty}><span aria-hidden="true">⚑</span><h3>{data.events === 0 ? 'Tu primera competencia empieza contigo' : 'No hay eventos en la agenda'}</h3><p>{data.events === 0 ? 'Cuando crees tu primer evento, podrás seguir su avance desde este espacio.' : 'Aquí aparecen eventos en inscripción o activos que aún no han terminado.'}</p></div> : <ul className={styles.eventList}>{data.next_events.map(event=><li key={event.id}><div className={styles.eventMark} aria-hidden="true">◈</div><div className={styles.eventInfo}><h3>{event.name}</h3><p>{event.city || event.location || 'Lugar por definir'}</p><time dateTime={event.start_date}>{date.format(new Date(event.start_date))}</time></div><span className={event.status === 'ACTIVE' ? styles.active : styles.registration}>{event.status === 'ACTIVE' ? 'En curso' : 'Inscripciones'}</span></li>)}</ul>}
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

```

## lib/dashboard/read.ts

```tsx
import 'server-only';
import { requireAccess } from '../auth/authorization';
import { createClient } from '../supabase/server';
import { dashboardSchema, type DashboardResult } from './schema';
export async function readDashboard(): Promise<DashboardResult> {
  await requireAccess('admin');
  try {
    const client = await createClient();
    const { data, error } = await client.rpc('admin_dashboard');
    if (error) return { data: null, error: error.code === 'PGRST202' ? 'setup' : 'unavailable' };
    const result = dashboardSchema.safeParse(data);
    return result.success ? { data: result.data, error: null } : { data: null, error: 'unavailable' };
  } catch { return { data: null, error: 'unavailable' }; }
}

```

## lib/dashboard/schema.ts

```tsx
import { z } from 'zod';
const count = z.number().int().nonnegative();
export const dashboardSchema = z.object({
  events: count, active_events: count, upcoming_events: count,
  teams: count, participants: count, judges: count,
  next_events: z.array(z.object({
    id: z.string().uuid(), name: z.string(), status: z.enum(['REGISTRATION', 'ACTIVE']),
    start_date: z.string().datetime({ offset: true }), end_date: z.string().datetime({ offset: true }),
    city: z.string().nullable(), location: z.string().nullable(),
  })).max(5),
});
export type DashboardData = z.infer<typeof dashboardSchema>;
export type DashboardResult = { data: DashboardData; error: null } | { data: null; error: 'setup' | 'unavailable' };

```

## supabase/migrations/202609200001_admin_dashboard.sql

```sql
-- FASE 8: resumen de solo lectura. Se puede ejecutar nuevamente.
-- No cambia RLS, no concede lectura directa de tablas ni permite escrituras.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_dashboard()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  viewer uuid := auth.uid();
  viewer_role public.user_role;
  result jsonb;
BEGIN
  SELECT role INTO viewer_role FROM public.profiles WHERE id = viewer AND active;
  IF viewer_role IS NULL OR viewer_role NOT IN ('SUPER_ADMIN', 'ADMIN') THEN
    RAISE EXCEPTION 'Acceso administrativo requerido' USING ERRCODE = '42501';
  END IF;
  WITH visible_events AS MATERIALIZED (
    SELECT id, name, status, start_date, end_date, city, location
    FROM public.events WHERE viewer_role = 'SUPER_ADMIN' OR created_by = viewer
  ), visible_teams AS MATERIALIZED (
    SELECT t.id FROM public.teams t JOIN visible_events e ON e.id = t.event_id
  ), next_events AS (
    SELECT id, name, status, start_date, end_date, city, location
    FROM visible_events WHERE status IN ('REGISTRATION','ACTIVE') AND end_date >= now()
    ORDER BY start_date, id LIMIT 5
  )
  SELECT jsonb_build_object(
    'events', (SELECT count(*) FROM visible_events),
    'active_events', (SELECT count(*) FROM visible_events WHERE status = 'ACTIVE'),
    'upcoming_events', (SELECT count(*) FROM visible_events WHERE start_date > now() AND status IN ('DRAFT','REGISTRATION','ACTIVE')),
    'teams', (SELECT count(*) FROM visible_teams),
    'participants', (SELECT count(DISTINCT m.participant_id) FROM public.team_members m JOIN visible_teams t ON t.id=m.team_id JOIN public.participants p ON p.id=m.participant_id WHERE m.active AND p.active),
    'judges', (SELECT count(DISTINCT a.judge_id) FROM public.judge_assignments a JOIN visible_events e ON e.id=a.event_id JOIN public.profiles p ON p.id=a.judge_id WHERE a.active AND p.active AND p.role='JUDGE'),
    'next_events', coalesce((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.start_date,n.id) FROM next_events n), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_dashboard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard() TO authenticated;
COMMENT ON FUNCTION public.admin_dashboard() IS 'Resumen limitado: superadmin global, admin solo eventos creados por él. Sin datos personales de participantes ni escrituras.';
NOTIFY pgrst, 'reload schema';
COMMIT;

```

## supabase/verify-phase-8.sql

```sql
-- Ejecutar después de 202609200001_admin_dashboard.sql.
-- Todos los valores passed deben ser true. No llama al resumen sin sesión.
SELECT '01. Función del dashboard instalada' AS check_name,
  to_regprocedure('public.admin_dashboard()') IS NOT NULL AS passed
UNION ALL
SELECT '02. Visitantes sin permiso de ejecución',
  NOT has_function_privilege('anon','public.admin_dashboard()','EXECUTE')
UNION ALL
SELECT '03. Autenticados pueden llamar; la función valida rol y actividad',
  has_function_privilege('authenticated','public.admin_dashboard()','EXECUTE')
UNION ALL
SELECT '04. Función con search_path fijo y solo lectura',
  EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.admin_dashboard()'::regprocedure
    AND prosecdef AND provolatile='s' AND proconfig @> ARRAY['search_path=""'])
UNION ALL
SELECT '05. Tablas de negocio siguen con RLS',
  bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.events'::regclass,'public.teams'::regclass,'public.participants'::regclass,'public.judge_assignments'::regclass,'public.team_members'::regclass)
ORDER BY check_name;

```