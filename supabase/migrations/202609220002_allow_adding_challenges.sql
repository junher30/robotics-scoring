-- Permite añadir retos a una categoría después de la primera puntuación, sin tocar
-- la fórmula ni los retos ya calificados. Repetible; requiere 202609210001_teams_scoring.sql.
BEGIN;
CREATE OR REPLACE FUNCTION public.roboscore_configure_scoring(p_event uuid,p_category uuid,p_rule text,p_count integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.events%ROWTYPE;c public.event_categories%ROWTYPE;i integer;existing public.category_scoring%ROWTYPE;scored_max integer;
BEGIN
 IF NOT roboscore_private.can_manage_event(p_event) THEN RAISE EXCEPTION 'No tienes acceso a este evento.' USING ERRCODE='42501'; END IF;
 SELECT * INTO e FROM public.events WHERE id=p_event FOR UPDATE;
 SELECT * INTO c FROM public.event_categories WHERE id=p_category AND event_id=p_event FOR UPDATE;
 IF NOT FOUND OR c.status='CLOSED' OR e.status IN ('FINISHED','CANCELLED') THEN RAISE EXCEPTION 'El evento o la categoría no están disponibles para configurar.' USING ERRCODE='22023'; END IF;
 IF p_rule IS NULL OR p_rule NOT IN ('EXCEL_2026','LEGACY_C','LEGACY_D') OR p_count IS NULL OR p_count NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Selecciona una regla y entre 1 y 20 retos.' USING ERRCODE='22023'; END IF;
 SELECT * INTO existing FROM public.category_scoring WHERE category_id=p_category;
 SELECT max(ec.sort_order) INTO scored_max FROM public.event_challenges ec JOIN public.team_scores s ON s.challenge_id=ec.id WHERE ec.category_id=p_category;
 -- La fórmula (rule) queda fija en cuanto hay una puntuación: cambiarla alteraría
 -- el significado de los puntos ya guardados. El número de retos sí puede crecer;
 -- solo se bloquea si se intenta bajar por debajo de un reto que ya tiene puntuaciones.
 IF scored_max IS NOT NULL AND existing.rule IS DISTINCT FROM p_rule THEN
  RAISE EXCEPTION 'La regla queda fija después de la primera puntuación.' USING ERRCODE='22023'; END IF;
 IF scored_max IS NOT NULL AND p_count<scored_max THEN
  RAISE EXCEPTION 'No puedes reducir los retos por debajo de uno que ya tiene puntuaciones.' USING ERRCODE='22023'; END IF;
 INSERT INTO public.category_scoring(category_id,event_id,rule,challenge_count,configured_by) VALUES(p_category,p_event,p_rule,p_count,auth.uid())
 ON CONFLICT(category_id) DO UPDATE SET rule=excluded.rule,challenge_count=excluded.challenge_count,configured_by=excluded.configured_by,updated_at=clock_timestamp();
 FOR i IN 1..p_count LOOP
  INSERT INTO public.event_challenges(event_id,category_id,name,sort_order) VALUES(p_event,p_category,'Reto '||i,i) ON CONFLICT(category_id,sort_order) DO NOTHING;
 END LOOP;
 UPDATE public.event_challenges SET active=(sort_order<=p_count) WHERE category_id=p_category;
 RETURN p_category;
END;
$$;
REVOKE ALL ON FUNCTION public.roboscore_configure_scoring(uuid,uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roboscore_configure_scoring(uuid,uuid,text,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
