-- Expone la foto (logo_url) y la descripción del evento en el tablero público,
-- para mostrarlas cuando un visitante selecciona ese evento. Ambos campos ya
-- existían y los organizadores ya podían llenarlos; solo no se mostraban.
-- Repetible; requiere 202609210002_public_results.sql.
BEGIN;
CREATE OR REPLACE FUNCTION public.roboscore_public_results()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH visible_events AS (
  SELECT id,name,city,status,description,logo_url FROM public.events WHERE public AND status IN ('ACTIVE','FINISHED')
 ), visible_categories AS (
  SELECT c.id,c.event_id,c.name,r.rule,r.challenge_count FROM public.event_categories c JOIN visible_events e ON e.id=c.event_id
  LEFT JOIN public.category_scoring r ON r.category_id=c.id WHERE c.status IN ('ACTIVE','CLOSED')
 ), totals AS (
  SELECT t.id,t.event_id,t.category_id,t.name,t.institution,t.robot_name,t.team_number,t.status,
   count(s.id) AS scored_count,sum(s.points) AS total,max(s.updated_at) AS last_scored_at
  FROM public.teams t JOIN visible_categories c ON c.id=t.category_id
  LEFT JOIN public.team_scores s ON s.team_id=t.id GROUP BY t.id
 ), positions AS (
  SELECT id,rank() OVER(PARTITION BY category_id ORDER BY total DESC) AS position
  FROM totals WHERE status='ACTIVE' AND scored_count>0
 ) SELECT jsonb_build_object(
  'events',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.name,e.id) FROM visible_events e),'[]'::jsonb),
  'categories',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.name,c.id) FROM visible_categories c),'[]'::jsonb),
  'teams',coalesce((SELECT jsonb_agg(to_jsonb(t)||jsonb_build_object('position',p.position) ORDER BY t.name,t.id) FROM totals t LEFT JOIN positions p ON p.id=t.id),'[]'::jsonb)
 );
$$;
REVOKE ALL ON FUNCTION public.roboscore_public_results() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roboscore_public_results() TO anon,authenticated;
COMMENT ON FUNCTION public.roboscore_public_results() IS 'Public projection only: no contacts, members, notes, profiles or private events. No direct table grants.';
NOTIFY pgrst,'reload schema';
COMMIT;
