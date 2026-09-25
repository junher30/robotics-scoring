-- Número de equipo (único por categoría) y nombres de participantes. Ambos solo se
-- exponen a organizadores y jueces vía las funciones existentes; nunca aparecen en
-- roboscore_public_results(). Repetible; requiere 202609210001_teams_scoring.sql.
BEGIN;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS team_number integer CHECK (team_number IS NULL OR team_number>0);
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS participant_names text[] NOT NULL DEFAULT '{}' CHECK (cardinality(participant_names)<=10);
-- El número solo debe ser único dentro de su categoría (CATA #3 y CATB #3 pueden coexistir).
CREATE UNIQUE INDEX IF NOT EXISTS teams_number_per_category ON public.teams(category_id,team_number) WHERE team_number IS NOT NULL;

DROP FUNCTION IF EXISTS public.roboscore_save_team(uuid,uuid,timestamptz,uuid,text,text,text,boolean);
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

-- Añade el número de equipo al tablero administrativo (los organizadores ya ven todo lo demás).
CREATE OR REPLACE FUNCTION public.roboscore_scoring_board(p_event uuid,p_category uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE board jsonb;
BEGIN
 IF NOT roboscore_private.can_manage_event(p_event) THEN RAISE EXCEPTION 'No tienes acceso a este evento.' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.event_categories WHERE id=p_category AND event_id=p_event) THEN RAISE EXCEPTION 'Categoría no disponible.' USING ERRCODE='22023'; END IF;
 SELECT jsonb_build_object(
  'has_scores',EXISTS(SELECT 1 FROM public.team_scores WHERE category_id=p_category),
  'config',(SELECT to_jsonb(r) FROM public.category_scoring r WHERE category_id=p_category),
  'challenges',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'sort_order',sort_order) ORDER BY sort_order) FROM public.event_challenges WHERE category_id=p_category AND active),'[]'::jsonb),
  'teams',coalesce((SELECT jsonb_agg(to_jsonb(ranked) ORDER BY total DESC NULLS LAST,name,id) FROM (
   SELECT totals.*,CASE WHEN scored_count>0 THEN rank() OVER(ORDER BY total DESC NULLS LAST) ELSE NULL END AS position FROM (
    SELECT t.id,t.name,t.institution,t.team_number,count(s.id) AS scored_count,sum(s.points) AS total,
     coalesce(jsonb_agg(jsonb_build_object('id',s.id,'challenge_id',s.challenge_id,'attempt',s.attempt,'seconds',s.seconds,'completed',s.completed,'points',s.points,'notes',s.notes,'updated_at',s.updated_at)) FILTER(WHERE s.id IS NOT NULL),'[]'::jsonb) AS scores
    FROM public.teams t LEFT JOIN public.team_scores s ON s.team_id=t.id
    WHERE t.category_id=p_category AND t.status='ACTIVE' GROUP BY t.id
   ) totals
  ) ranked),'[]'::jsonb)) INTO board;
 RETURN board;
END;
$$;
REVOKE ALL ON FUNCTION public.roboscore_scoring_board(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roboscore_scoring_board(uuid,uuid) TO authenticated;

-- Los jueces ven el número de equipo en el listado y, además, los participantes en la ficha del equipo.
CREATE OR REPLACE FUNCTION public.roboscore_judge_category(p_category uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT roboscore_private.judge_can_score(p_category) THEN RAISE EXCEPTION 'La categoría ya no está asignada a tu cuenta.' USING ERRCODE='42501'; END IF;
 RETURN (SELECT jsonb_build_object('event_id',e.id,'event_name',e.name,'event_status',e.status,'category_id',c.id,'category_name',c.name,'category_status',c.status,'rule',r.rule,'challenge_count',r.challenge_count,
 'teams',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'institution',t.institution,'robot_name',t.robot_name,'team_number',t.team_number,'scored_count',(SELECT count(*) FROM public.team_scores s WHERE s.team_id=t.id),'total',(SELECT sum(s.points) FROM public.team_scores s WHERE s.team_id=t.id)) ORDER BY t.name,t.id) FROM public.teams t WHERE t.category_id=c.id AND t.status='ACTIVE'),'[]'::jsonb)) FROM public.event_categories c JOIN public.events e ON e.id=c.event_id LEFT JOIN public.category_scoring r ON r.category_id=c.id WHERE c.id=p_category);
END;
$$;

CREATE OR REPLACE FUNCTION public.roboscore_judge_team(p_team uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.teams%ROWTYPE;
BEGIN
 SELECT * INTO t FROM public.teams WHERE id=p_team;
 IF NOT FOUND OR NOT roboscore_private.judge_can_score(t.category_id) THEN RAISE EXCEPTION 'El equipo no pertenece a una categoría asignada.' USING ERRCODE='42501'; END IF;
 RETURN (SELECT jsonb_build_object('event_id',e.id,'event_name',e.name,'event_status',e.status,'category_id',c.id,'category_name',c.name,'category_status',c.status,'rule',r.rule,'challenge_count',r.challenge_count,
 'team',jsonb_build_object('id',t.id,'name',t.name,'institution',t.institution,'status',t.status,'team_number',t.team_number,'participant_names',t.participant_names),
 'challenges',coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'sort_order',x.sort_order) ORDER BY x.sort_order) FROM public.event_challenges x WHERE x.category_id=c.id AND x.active),'[]'::jsonb),
 'scores',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'challenge_id',s.challenge_id,'attempt',s.attempt,'seconds',s.seconds,'completed',s.completed,'points',s.points,'notes',s.notes,'updated_at',s.updated_at)) FROM public.team_scores s WHERE s.team_id=t.id),'[]'::jsonb)) FROM public.event_categories c JOIN public.events e ON e.id=c.event_id LEFT JOIN public.category_scoring r ON r.category_id=c.id WHERE c.id=t.category_id);
END;
$$;
REVOKE ALL ON FUNCTION public.roboscore_judge_category(uuid),public.roboscore_judge_team(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roboscore_judge_category(uuid),public.roboscore_judge_team(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
