-- Asignación y calificación de jueces. Repetible. Requiere usuarios, equipos y eliminación de jueces.
BEGIN;
CREATE OR REPLACE FUNCTION roboscore_private.judge_can_score(p_category uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.judge_assignments a JOIN public.profiles p ON p.id=a.judge_id
 WHERE a.category_id=p_category AND a.judge_id=auth.uid() AND a.active AND p.active AND p.deleted_at IS NULL AND p.role='JUDGE');
$$;
REVOKE ALL ON FUNCTION roboscore_private.judge_can_score(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION roboscore_private.judge_can_score(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.roboscore_assign_judge(p_event uuid,p_category uuid,p_judge uuid,p_active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.profiles%ROWTYPE;target public.profiles%ROWTYPE;assignment_id uuid;
BEGIN
 PERFORM id FROM public.profiles WHERE id IN(auth.uid(),p_judge) ORDER BY id FOR UPDATE;
 SELECT * INTO actor FROM public.profiles WHERE id=auth.uid();
 PERFORM id FROM public.events WHERE id=p_event FOR UPDATE;
 IF NOT roboscore_private.can_manage_event(p_event) THEN RAISE EXCEPTION 'No puedes gestionar los jueces de este evento.' USING ERRCODE='42501'; END IF;
 IF p_active IS NULL OR NOT EXISTS(SELECT 1 FROM public.event_categories WHERE id=p_category AND event_id=p_event) THEN RAISE EXCEPTION 'Selecciona una categoría del evento.' USING ERRCODE='22023'; END IF;
 IF NOT p_active THEN
  UPDATE public.judge_assignments SET active=false WHERE event_id=p_event AND category_id=p_category AND judge_id=p_judge RETURNING id INTO assignment_id;
  IF assignment_id IS NULL THEN RAISE EXCEPTION 'La asignación no existe. Recarga la página.' USING ERRCODE='22023'; END IF;
  RETURN assignment_id;
 END IF;
 SELECT * INTO target FROM public.profiles WHERE id=p_judge;
 IF NOT FOUND OR target.role<>'JUDGE' OR NOT target.active OR target.deleted_at IS NOT NULL OR (actor.role='ADMIN' AND target.managed_by IS DISTINCT FROM actor.id) THEN RAISE EXCEPTION 'Selecciona un juez activo que puedas gestionar.' USING ERRCODE='42501'; END IF;
 INSERT INTO public.judge_assignments(judge_id,event_id,category_id,assigned_by,active) VALUES(p_judge,p_event,p_category,actor.id,true)
 ON CONFLICT(judge_id,category_id) DO UPDATE SET active=true,assigned_by=excluded.assigned_by RETURNING id INTO assignment_id;
 RETURN assignment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.roboscore_event_judges(p_event uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT roboscore_private.can_manage_event(p_event) THEN RAISE EXCEPTION 'No tienes acceso a este evento.' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
 'judges',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',concat_ws(' ',p.first_name,p.last_name),'email',p.email) ORDER BY p.first_name,p.id) FROM public.profiles p WHERE p.role='JUDGE' AND p.active AND p.deleted_at IS NULL AND (p.managed_by=auth.uid() OR EXISTS(SELECT 1 FROM public.profiles me WHERE me.id=auth.uid() AND me.role='SUPER_ADMIN' AND me.active))),'[]'::jsonb),
 'assignments',coalesce((SELECT jsonb_agg(jsonb_build_object('judge_id',a.judge_id,'category_id',a.category_id,'name',concat_ws(' ',p.first_name,p.last_name),'active',a.active,'available',p.active AND p.deleted_at IS NULL AND p.role='JUDGE') ORDER BY p.first_name,a.id) FROM public.judge_assignments a JOIN public.profiles p ON p.id=a.judge_id WHERE a.event_id=p_event AND a.active),'[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.roboscore_judge_home()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active AND deleted_at IS NULL AND role='JUDGE') THEN RAISE EXCEPTION 'Tu cuenta de juez no está habilitada.' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'event_id',e.id,'event_name',e.name,'event_status',e.status,'category_id',c.id,'category_name',c.name,'category_status',c.status,'rule',r.rule,'challenge_count',r.challenge_count,
 'teams',(SELECT count(*) FROM public.teams t WHERE t.category_id=c.id AND t.status='ACTIVE')) ORDER BY e.name,c.name,a.id)
 FROM public.judge_assignments a JOIN public.events e ON e.id=a.event_id JOIN public.event_categories c ON c.id=a.category_id LEFT JOIN public.category_scoring r ON r.category_id=c.id WHERE a.judge_id=auth.uid() AND a.active),'[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.roboscore_judge_category(p_category uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT roboscore_private.judge_can_score(p_category) THEN RAISE EXCEPTION 'La categoría ya no está asignada a tu cuenta.' USING ERRCODE='42501'; END IF;
 RETURN (SELECT jsonb_build_object('event_id',e.id,'event_name',e.name,'event_status',e.status,'category_id',c.id,'category_name',c.name,'category_status',c.status,'rule',r.rule,'challenge_count',r.challenge_count,
 'teams',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'institution',t.institution,'robot_name',t.robot_name,'scored_count',(SELECT count(*) FROM public.team_scores s WHERE s.team_id=t.id),'total',(SELECT sum(s.points) FROM public.team_scores s WHERE s.team_id=t.id)) ORDER BY t.name,t.id) FROM public.teams t WHERE t.category_id=c.id AND t.status='ACTIVE'),'[]'::jsonb)) FROM public.event_categories c JOIN public.events e ON e.id=c.event_id LEFT JOIN public.category_scoring r ON r.category_id=c.id WHERE c.id=p_category);
END;
$$;

CREATE OR REPLACE FUNCTION public.roboscore_judge_team(p_team uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.teams%ROWTYPE;
BEGIN
 SELECT * INTO t FROM public.teams WHERE id=p_team;
 IF NOT FOUND OR NOT roboscore_private.judge_can_score(t.category_id) THEN RAISE EXCEPTION 'El equipo no pertenece a una categoría asignada.' USING ERRCODE='42501'; END IF;
 RETURN (SELECT jsonb_build_object('event_id',e.id,'event_name',e.name,'event_status',e.status,'category_id',c.id,'category_name',c.name,'category_status',c.status,'rule',r.rule,'challenge_count',r.challenge_count,
 'team',jsonb_build_object('id',t.id,'name',t.name,'institution',t.institution,'status',t.status),
 'challenges',coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'sort_order',x.sort_order) ORDER BY x.sort_order) FROM public.event_challenges x WHERE x.category_id=c.id AND x.active),'[]'::jsonb),
 'scores',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'challenge_id',s.challenge_id,'attempt',s.attempt,'seconds',s.seconds,'completed',s.completed,'points',s.points,'notes',s.notes,'updated_at',s.updated_at)) FROM public.team_scores s WHERE s.team_id=t.id),'[]'::jsonb)) FROM public.event_categories c JOIN public.events e ON e.id=c.event_id LEFT JOIN public.category_scoring r ON r.category_id=c.id WHERE c.id=t.category_id);
END;
$$;
REVOKE ALL ON FUNCTION public.roboscore_assign_judge(uuid,uuid,uuid,boolean),public.roboscore_event_judges(uuid),public.roboscore_judge_home(),public.roboscore_judge_category(uuid),public.roboscore_judge_team(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roboscore_assign_judge(uuid,uuid,uuid,boolean),public.roboscore_event_judges(uuid),public.roboscore_judge_home(),public.roboscore_judge_category(uuid),public.roboscore_judge_team(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.roboscore_save_score(p_event uuid,p_team uuid,p_challenge uuid,p_version timestamptz,p_attempt integer,p_seconds numeric,p_completed boolean,p_notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events%ROWTYPE;t public.teams%ROWTYPE;c public.event_categories%ROWTYPE;r public.category_scoring%ROWTYPE;s public.team_scores%ROWTYPE;before_data jsonb;result_id uuid;
BEGIN
 PERFORM id FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 SELECT * INTO e FROM public.events WHERE id=p_event FOR UPDATE;
 IF NOT roboscore_private.can_manage_event(p_event) AND NOT EXISTS(SELECT 1 FROM public.teams candidate WHERE candidate.id=p_team AND candidate.event_id=p_event AND roboscore_private.judge_can_score(candidate.category_id)) THEN RAISE EXCEPTION 'No tienes una asignación activa para puntuar este equipo.' USING ERRCODE='42501'; END IF;
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


REVOKE ALL ON FUNCTION public.roboscore_save_score(uuid,uuid,uuid,timestamptz,integer,numeric,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.roboscore_save_score(uuid,uuid,uuid,timestamptz,integer,numeric,boolean,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
