-- Dos ajustes al número de equipo:
-- 1) Único por categoría (no por evento): CATA #3 y CATB #3 pueden coexistir.
-- 2) Se expone en el tablero público (no es dato sensible, a diferencia de los
--    nombres de participantes, que siguen siendo solo para jueces/organizadores).
-- Repetible; requiere 202609220003_team_number_and_participants.sql y
-- 202609210002_public_results.sql.
BEGIN;
DROP INDEX IF EXISTS public.teams_number_per_event;
CREATE UNIQUE INDEX IF NOT EXISTS teams_number_per_category ON public.teams(category_id,team_number) WHERE team_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.roboscore_save_team(p_event uuid,p_id uuid,p_version timestamptz,p_category uuid,p_name text,p_institution text,p_robot text,p_active boolean,p_number integer,p_participants text[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events%ROWTYPE;c public.event_categories%ROWTYPE;t public.teams%ROWTYPE;participants text[];
BEGIN
 IF NOT roboscore_private.can_manage_event(p_event) THEN RAISE EXCEPTION 'No tienes acceso a este evento.' USING ERRCODE='42501'; END IF;
 SELECT * INTO e FROM public.events WHERE id=p_event FOR UPDATE;
 IF e.status IN ('FINISHED','CANCELLED') THEN RAISE EXCEPTION 'El evento está cerrado. Reábrelo antes de modificar equipos.' USING ERRCODE='22023'; END IF;
 SELECT * INTO c FROM public.event_categories WHERE id=p_category AND event_id=p_event FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'La categoría no pertenece a este evento.' USING ERRCODE='22023'; END IF;
 IF p_id IS NULL OR p_active IS NULL OR coalesce(length(btrim(p_name)),0) NOT BETWEEN 1 AND 150 OR coalesce(length(btrim(p_institution)),0) NOT BETWEEN 1 AND 200 OR coalesce(length(p_robot),0)>150 THEN
  RAISE EXCEPTION 'Revisa nombre, institución y robot.' USING ERRCODE='22023'; END IF;
 IF p_number IS NOT NULL AND p_number<=0 THEN RAISE EXCEPTION 'El número de equipo debe ser mayor que cero.' USING ERRCODE='22023'; END IF;
 IF p_participants IS NOT NULL AND (cardinality(p_participants)>10 OR EXISTS(SELECT 1 FROM unnest(p_participants) n WHERE length(btrim(n)) NOT BETWEEN 1 AND 150)) THEN
  RAISE EXCEPTION 'Revisa los nombres de los participantes (máximo 10, cada uno de 1 a 150 caracteres).' USING ERRCODE='22023'; END IF;
 participants:=coalesce((SELECT array_agg(btrim(n)) FROM unnest(coalesce(p_participants,'{}'::text[])) n),'{}');
 SELECT * INTO t FROM public.teams WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  IF t.event_id<>p_event THEN RAISE EXCEPTION 'Equipo no disponible.' USING ERRCODE='42501'; END IF;
  IF p_version IS NULL THEN
   IF t.category_id=p_category AND t.name=btrim(p_name) AND t.institution=btrim(p_institution) AND coalesce(t.robot_name,'')=coalesce(btrim(p_robot),'') AND (t.status='ACTIVE')=p_active AND t.team_number IS NOT DISTINCT FROM p_number AND t.participant_names=participants THEN RETURN t.id; END IF;
   RAISE EXCEPTION 'El equipo ya existe. Abre su ficha.' USING ERRCODE='40001';
  END IF;
  IF p_version IS DISTINCT FROM t.updated_at THEN RAISE EXCEPTION 'El equipo cambió. Recarga su ficha.' USING ERRCODE='40001'; END IF;
  IF t.category_id<>p_category AND EXISTS(SELECT 1 FROM public.team_scores WHERE team_id=p_id) THEN RAISE EXCEPTION 'Un equipo con puntuaciones conserva su categoría.' USING ERRCODE='22023'; END IF;
 ELSIF p_version IS NOT NULL THEN RAISE EXCEPTION 'Equipo no disponible.' USING ERRCODE='40001'; END IF;
 IF p_active AND c.status='CLOSED' THEN RAISE EXCEPTION 'La categoría está cerrada.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.teams WHERE event_id=p_event AND category_id=p_category AND id<>p_id AND lower(btrim(name))=lower(btrim(p_name))) THEN RAISE EXCEPTION 'Ya existe un equipo con ese nombre en la categoría.' USING ERRCODE='23505'; END IF;
 IF p_number IS NOT NULL AND EXISTS(SELECT 1 FROM public.teams WHERE category_id=p_category AND team_number=p_number AND id<>p_id) THEN RAISE EXCEPTION 'Ya existe un equipo con ese número en esta categoría.' USING ERRCODE='23505'; END IF;
 IF p_active AND (t.id IS NULL OR t.status='REJECTED' OR t.category_id<>p_category) THEN
  IF c.max_teams IS NOT NULL AND (SELECT count(*) FROM public.teams WHERE category_id=p_category AND id<>p_id AND status<>'REJECTED')>=c.max_teams THEN RAISE EXCEPTION 'La categoría alcanzó su máximo de equipos.' USING ERRCODE='22023'; END IF;
  IF e.max_teams IS NOT NULL AND (SELECT count(*) FROM public.teams WHERE event_id=p_event AND id<>p_id AND status<>'REJECTED')>=e.max_teams THEN RAISE EXCEPTION 'El evento alcanzó su máximo de equipos.' USING ERRCODE='22023'; END IF;
 END IF;
 IF t.id IS NULL THEN
  INSERT INTO public.teams(id,event_id,category_id,name,institution,robot_name,status,team_number,participant_names) VALUES(p_id,p_event,p_category,btrim(p_name),btrim(p_institution),nullif(btrim(p_robot),''),CASE WHEN p_active THEN 'ACTIVE'::public.team_status ELSE 'REJECTED'::public.team_status END,p_number,participants);
 ELSE
  UPDATE public.teams SET category_id=p_category,name=btrim(p_name),institution=btrim(p_institution),robot_name=nullif(btrim(p_robot),''),status=CASE WHEN p_active THEN 'ACTIVE'::public.team_status ELSE 'REJECTED'::public.team_status END,team_number=p_number,participant_names=participants WHERE id=p_id;
 END IF;
 RETURN p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.roboscore_save_team(uuid,uuid,timestamptz,uuid,text,text,text,boolean,integer,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roboscore_save_team(uuid,uuid,timestamptz,uuid,text,text,text,boolean,integer,text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.roboscore_public_results()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH visible_events AS (
  SELECT id,name,city,status FROM public.events WHERE public AND status IN ('ACTIVE','FINISHED')
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
