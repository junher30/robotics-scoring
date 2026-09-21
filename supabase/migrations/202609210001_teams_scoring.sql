-- Equipos y puntuación administrativa. Repetible. Requiere fases 3, 4, 9 y 10.
BEGIN;
CREATE OR REPLACE FUNCTION roboscore_private.can_manage_event(p_event uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.events e JOIN public.profiles p ON p.id=auth.uid()
 WHERE e.id=p_event AND p.active AND (p.role='SUPER_ADMIN' OR (p.role='ADMIN' AND e.created_by=p.id)));
$$;
REVOKE ALL ON FUNCTION roboscore_private.can_manage_event(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION roboscore_private.can_manage_event(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.roboscore_score_points(p_rule text,p_attempt integer,p_seconds numeric,p_completed boolean)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN p_rule='EXCEL_2026' AND p_attempt=0 THEN 0
 WHEN p_rule IN ('LEGACY_C','LEGACY_D') AND NOT p_completed THEN 0
 ELSE (CASE WHEN p_attempt=1 THEN 170 WHEN p_attempt=2 THEN CASE WHEN p_rule='LEGACY_C' THEN 90 ELSE 150 END ELSE 130 END)-p_seconds END;
$$;
REVOKE ALL ON FUNCTION public.roboscore_score_points(text,integer,numeric,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.roboscore_score_points(text,integer,numeric,boolean) TO authenticated;
CREATE TABLE IF NOT EXISTS public.category_scoring (
 category_id uuid PRIMARY KEY,
 event_id uuid NOT NULL,
 rule text NOT NULL CHECK(rule IN ('EXCEL_2026','LEGACY_C','LEGACY_D')),
 challenge_count integer NOT NULL CHECK(challenge_count BETWEEN 1 AND 20),
 configured_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(event_id,category_id) REFERENCES public.event_categories(event_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS teams_scoring_identity ON public.teams(event_id,category_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS challenges_scoring_identity ON public.event_challenges(event_id,category_id,id);
CREATE TABLE IF NOT EXISTS public.team_scores (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL,category_id uuid NOT NULL,team_id uuid NOT NULL,challenge_id uuid NOT NULL,
 rule text NOT NULL CHECK(rule IN ('EXCEL_2026','LEGACY_C','LEGACY_D')),
 attempt integer NOT NULL CHECK(attempt>=0),
 seconds numeric(12,3) NOT NULL CHECK(seconds>=0 AND seconds<=999999999.999),
 completed boolean NOT NULL,
 points numeric GENERATED ALWAYS AS (public.roboscore_score_points(rule,attempt,seconds,completed)) STORED,
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=1000),
 recorded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(team_id,challenge_id),
 FOREIGN KEY(event_id,category_id,team_id) REFERENCES public.teams(event_id,category_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(event_id,category_id,challenge_id) REFERENCES public.event_challenges(event_id,category_id,id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS public.score_revisions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 score_id uuid NOT NULL REFERENCES public.team_scores(id) ON DELETE RESTRICT,
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
 changed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 old_data jsonb,new_data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scores_category_idx ON public.team_scores(category_id);
CREATE INDEX IF NOT EXISTS score_revisions_score_idx ON public.score_revisions(score_id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['teams','event_challenges','category_scoring','team_scores','score_revisions'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('DROP POLICY IF EXISTS scoring_admin_read ON public.%I',t);
  EXECUTE format('CREATE POLICY scoring_admin_read ON public.%I FOR SELECT TO authenticated USING (roboscore_private.can_manage_event(event_id))',t);
 END LOOP;
END $$;
REVOKE ALL ON public.category_scoring,public.team_scores,public.score_revisions FROM PUBLIC,anon;
REVOKE INSERT,UPDATE,DELETE ON public.category_scoring,public.team_scores,public.score_revisions FROM authenticated;

CREATE OR REPLACE FUNCTION public.roboscore_save_team(p_event uuid,p_id uuid,p_version timestamptz,p_category uuid,p_name text,p_institution text,p_robot text,p_active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events%ROWTYPE;c public.event_categories%ROWTYPE;t public.teams%ROWTYPE;
BEGIN
 IF NOT roboscore_private.can_manage_event(p_event) THEN RAISE EXCEPTION 'No tienes acceso a este evento.' USING ERRCODE='42501'; END IF;
 SELECT * INTO e FROM public.events WHERE id=p_event FOR UPDATE;
 IF e.status IN ('FINISHED','CANCELLED') THEN RAISE EXCEPTION 'El evento está cerrado. Reábrelo antes de modificar equipos.' USING ERRCODE='22023'; END IF;
 SELECT * INTO c FROM public.event_categories WHERE id=p_category AND event_id=p_event FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'La categoría no pertenece a este evento.' USING ERRCODE='22023'; END IF;
 IF p_id IS NULL OR p_active IS NULL OR coalesce(length(btrim(p_name)),0) NOT BETWEEN 1 AND 150 OR coalesce(length(btrim(p_institution)),0) NOT BETWEEN 1 AND 200 OR coalesce(length(p_robot),0)>150 THEN
  RAISE EXCEPTION 'Revisa nombre, institución y robot.' USING ERRCODE='22023'; END IF;
 SELECT * INTO t FROM public.teams WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  IF t.event_id<>p_event THEN RAISE EXCEPTION 'Equipo no disponible.' USING ERRCODE='42501'; END IF;
  IF p_version IS NULL THEN
   IF t.category_id=p_category AND t.name=btrim(p_name) AND t.institution=btrim(p_institution) AND coalesce(t.robot_name,'')=coalesce(btrim(p_robot),'') AND (t.status='ACTIVE')=p_active THEN RETURN t.id; END IF;
   RAISE EXCEPTION 'El equipo ya existe. Abre su ficha.' USING ERRCODE='40001';
  END IF;
  IF p_version IS DISTINCT FROM t.updated_at THEN RAISE EXCEPTION 'El equipo cambió. Recarga su ficha.' USING ERRCODE='40001'; END IF;
  IF t.category_id<>p_category AND EXISTS(SELECT 1 FROM public.team_scores WHERE team_id=p_id) THEN RAISE EXCEPTION 'Un equipo con puntuaciones conserva su categoría.' USING ERRCODE='22023'; END IF;
 ELSIF p_version IS NOT NULL THEN RAISE EXCEPTION 'Equipo no disponible.' USING ERRCODE='40001'; END IF;
 IF p_active AND c.status='CLOSED' THEN RAISE EXCEPTION 'La categoría está cerrada.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.teams WHERE event_id=p_event AND category_id=p_category AND id<>p_id AND lower(btrim(name))=lower(btrim(p_name))) THEN RAISE EXCEPTION 'Ya existe un equipo con ese nombre en la categoría.' USING ERRCODE='23505'; END IF;
 IF p_active AND (t.id IS NULL OR t.status='REJECTED' OR t.category_id<>p_category) THEN
  IF c.max_teams IS NOT NULL AND (SELECT count(*) FROM public.teams WHERE category_id=p_category AND id<>p_id AND status<>'REJECTED')>=c.max_teams THEN RAISE EXCEPTION 'La categoría alcanzó su máximo de equipos.' USING ERRCODE='22023'; END IF;
  IF e.max_teams IS NOT NULL AND (SELECT count(*) FROM public.teams WHERE event_id=p_event AND id<>p_id AND status<>'REJECTED')>=e.max_teams THEN RAISE EXCEPTION 'El evento alcanzó su máximo de equipos.' USING ERRCODE='22023'; END IF;
 END IF;
 IF t.id IS NULL THEN
  INSERT INTO public.teams(id,event_id,category_id,name,institution,robot_name,status) VALUES(p_id,p_event,p_category,btrim(p_name),btrim(p_institution),nullif(btrim(p_robot),''),CASE WHEN p_active THEN 'ACTIVE'::public.team_status ELSE 'REJECTED'::public.team_status END);
 ELSE
  UPDATE public.teams SET category_id=p_category,name=btrim(p_name),institution=btrim(p_institution),robot_name=nullif(btrim(p_robot),''),status=CASE WHEN p_active THEN 'ACTIVE'::public.team_status ELSE 'REJECTED'::public.team_status END WHERE id=p_id;
 END IF;
 RETURN p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.roboscore_configure_scoring(p_event uuid,p_category uuid,p_rule text,p_count integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events%ROWTYPE;c public.event_categories%ROWTYPE;i integer;
BEGIN
 IF NOT roboscore_private.can_manage_event(p_event) THEN RAISE EXCEPTION 'No tienes acceso a este evento.' USING ERRCODE='42501'; END IF;
 SELECT * INTO e FROM public.events WHERE id=p_event FOR UPDATE;
 SELECT * INTO c FROM public.event_categories WHERE id=p_category AND event_id=p_event FOR UPDATE;
 IF NOT FOUND OR c.status='CLOSED' OR e.status IN ('FINISHED','CANCELLED') THEN RAISE EXCEPTION 'El evento o la categoría no están disponibles para configurar.' USING ERRCODE='22023'; END IF;
 IF p_rule IS NULL OR p_rule NOT IN ('EXCEL_2026','LEGACY_C','LEGACY_D') OR p_count IS NULL OR p_count NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Selecciona una regla y entre 1 y 20 retos.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.team_scores WHERE category_id=p_category) THEN RAISE EXCEPTION 'La regla y los retos quedan fijos después de la primera puntuación.' USING ERRCODE='22023'; END IF;
 INSERT INTO public.category_scoring(category_id,event_id,rule,challenge_count,configured_by) VALUES(p_category,p_event,p_rule,p_count,auth.uid())
 ON CONFLICT(category_id) DO UPDATE SET rule=excluded.rule,challenge_count=excluded.challenge_count,configured_by=excluded.configured_by,updated_at=clock_timestamp();
 FOR i IN 1..p_count LOOP
  INSERT INTO public.event_challenges(event_id,category_id,name,sort_order) VALUES(p_event,p_category,'Reto '||i,i) ON CONFLICT(category_id,sort_order) DO NOTHING;
 END LOOP;
 UPDATE public.event_challenges SET active=(sort_order<=p_count) WHERE category_id=p_category;
 RETURN p_category;
END;
$$;

CREATE OR REPLACE FUNCTION public.roboscore_save_score(p_event uuid,p_team uuid,p_challenge uuid,p_version timestamptz,p_attempt integer,p_seconds numeric,p_completed boolean,p_notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events%ROWTYPE;t public.teams%ROWTYPE;c public.event_categories%ROWTYPE;r public.category_scoring%ROWTYPE;s public.team_scores%ROWTYPE;before_data jsonb;result_id uuid;
BEGIN
 IF NOT roboscore_private.can_manage_event(p_event) THEN RAISE EXCEPTION 'No tienes acceso para puntuar este evento.' USING ERRCODE='42501'; END IF;
 SELECT * INTO e FROM public.events WHERE id=p_event FOR UPDATE;
 SELECT * INTO t FROM public.teams WHERE id=p_team AND event_id=p_event FOR UPDATE;
 IF NOT FOUND OR t.status<>'ACTIVE' THEN RAISE EXCEPTION 'El equipo no participa en este evento.' USING ERRCODE='22023'; END IF;
 SELECT * INTO c FROM public.event_categories WHERE id=t.category_id FOR UPDATE;
 IF e.status<>'ACTIVE' OR c.status<>'ACTIVE' THEN RAISE EXCEPTION 'Activa el evento y la categoría antes de puntuar.' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM public.category_scoring WHERE category_id=c.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Configura primero la regla de puntuación.' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.event_challenges WHERE id=p_challenge AND event_id=p_event AND category_id=c.id AND active) THEN RAISE EXCEPTION 'El reto no corresponde al equipo.' USING ERRCODE='22023'; END IF;
 IF p_attempt IS NULL OR p_attempt<0 OR p_seconds IS NULL OR p_seconds<0 OR p_seconds>999999999.999 OR p_seconds<>round(p_seconds,3) OR p_completed IS NULL OR coalesce(length(p_notes),0)>1000 THEN RAISE EXCEPTION 'Revisa intento, segundos (hasta 3 decimales) y observaciones.' USING ERRCODE='22023'; END IF;
 SELECT * INTO s FROM public.team_scores WHERE team_id=p_team AND challenge_id=p_challenge FOR UPDATE;
 IF FOUND THEN
  IF p_version IS DISTINCT FROM s.updated_at THEN RAISE EXCEPTION 'La puntuación cambió. Recarga para evitar sobrescribirla.' USING ERRCODE='40001'; END IF;
  IF coalesce(length(btrim(p_notes)),0)=0 THEN RAISE EXCEPTION 'Explica el motivo de la corrección.' USING ERRCODE='22023'; END IF;
  before_data=to_jsonb(s);
  UPDATE public.team_scores SET attempt=p_attempt,seconds=p_seconds,completed=CASE WHEN r.rule='EXCEL_2026' THEN p_attempt>0 ELSE p_completed END,notes=btrim(p_notes),recorded_by=auth.uid(),updated_at=clock_timestamp() WHERE id=s.id RETURNING id INTO result_id;
 ELSE
  IF p_version IS NOT NULL THEN RAISE EXCEPTION 'La puntuación no existe. Recarga.' USING ERRCODE='40001'; END IF;
  INSERT INTO public.team_scores(event_id,category_id,team_id,challenge_id,rule,attempt,seconds,completed,notes,recorded_by) VALUES(p_event,c.id,p_team,p_challenge,r.rule,p_attempt,p_seconds,CASE WHEN r.rule='EXCEL_2026' THEN p_attempt>0 ELSE p_completed END,coalesce(btrim(p_notes),''),auth.uid()) RETURNING id INTO result_id;
 END IF;
 INSERT INTO public.score_revisions(score_id,event_id,changed_by,old_data,new_data) SELECT id,event_id,auth.uid(),before_data,to_jsonb(team_scores) FROM public.team_scores WHERE id=result_id;
 RETURN result_id;
END;
$$;

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
    SELECT t.id,t.name,t.institution,count(s.id) AS scored_count,sum(s.points) AS total,
     coalesce(jsonb_agg(jsonb_build_object('id',s.id,'challenge_id',s.challenge_id,'attempt',s.attempt,'seconds',s.seconds,'completed',s.completed,'points',s.points,'notes',s.notes,'updated_at',s.updated_at)) FILTER(WHERE s.id IS NOT NULL),'[]'::jsonb) AS scores
    FROM public.teams t LEFT JOIN public.team_scores s ON s.team_id=t.id
    WHERE t.category_id=p_category AND t.status='ACTIVE' GROUP BY t.id
   ) totals
  ) ranked),'[]'::jsonb)) INTO board;
 RETURN board;
END;
$$;
REVOKE ALL ON FUNCTION public.roboscore_save_team(uuid,uuid,timestamptz,uuid,text,text,text,boolean),public.roboscore_configure_scoring(uuid,uuid,text,integer),public.roboscore_save_score(uuid,uuid,uuid,timestamptz,integer,numeric,boolean,text),public.roboscore_scoring_board(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roboscore_save_team(uuid,uuid,timestamptz,uuid,text,text,text,boolean),public.roboscore_configure_scoring(uuid,uuid,text,integer),public.roboscore_save_score(uuid,uuid,uuid,timestamptz,integer,numeric,boolean,text),public.roboscore_scoring_board(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
