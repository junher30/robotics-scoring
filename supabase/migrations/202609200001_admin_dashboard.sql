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
