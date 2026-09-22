-- Borrado permanente de eventos, solo para el SUPER_ADMIN y solo si el evento no
-- tiene ninguna categoría (y por lo tanto tampoco equipos, retos, puntuaciones ni
-- jueces asignados, ya que todos dependen de una categoría). Un evento con datos
-- reales solo puede cancelarse (status), nunca borrarse. Repetible; requiere
-- 202609200002_event_management.sql y 202609200003_category_management.sql.
BEGIN;
CREATE OR REPLACE FUNCTION public.roboscore_delete_event(p_event uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE deleted_id uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active AND role='SUPER_ADMIN') THEN
  RAISE EXCEPTION 'Solo el superadministrador puede eliminar eventos.' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.events WHERE id=p_event) THEN RAISE EXCEPTION 'El evento no existe o ya fue eliminado.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.event_categories WHERE event_id=p_event) THEN
  RAISE EXCEPTION 'Este evento ya tiene categorías, equipos o puntuaciones. Cancélalo desde su estado en vez de eliminarlo.' USING ERRCODE='22023'; END IF;
 DELETE FROM public.events WHERE id=p_event RETURNING id INTO deleted_id;
 RETURN deleted_id;
END;
$$;
REVOKE ALL ON FUNCTION public.roboscore_delete_event(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roboscore_delete_event(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
