-- Libera el correo de un juez eliminado (borra su reserva de invitación) para poder
-- volver a invitarlo. Repetible; requiere 202609210003_delete_judges.sql.
BEGIN;
CREATE OR REPLACE FUNCTION public.roboscore_delete_judge(p_id uuid,p_version timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.profiles%ROWTYPE;target public.profiles%ROWTYPE;
BEGIN
 PERFORM id FROM public.profiles WHERE id IN(auth.uid(),p_id) ORDER BY id FOR UPDATE;
 SELECT * INTO actor FROM public.profiles WHERE id=auth.uid();
 IF NOT FOUND OR NOT actor.active OR actor.deleted_at IS NOT NULL OR actor.role NOT IN('SUPER_ADMIN','ADMIN') THEN
  RAISE EXCEPTION 'No tienes permisos para eliminar jueces.' USING ERRCODE='42501'; END IF;
 SELECT * INTO target FROM public.profiles WHERE id=p_id;
 IF NOT FOUND OR target.id=actor.id OR target.role<>'JUDGE' OR (actor.role='ADMIN' AND target.managed_by IS DISTINCT FROM actor.id) THEN
  RAISE EXCEPTION 'No puedes eliminar este juez.' USING ERRCODE='42501'; END IF;
 -- La reserva de invitación queda huérfana si no se libera; sin esto, el correo original
 -- nunca vuelve a estar disponible aunque el perfil ya esté desactivado.
 DELETE FROM roboscore_private.user_invitations WHERE user_id=p_id;
 -- Reintentar la misma eliminación no vuelve a alterar el historial.
 IF target.deleted_at IS NOT NULL THEN RETURN p_id; END IF;
 IF p_version IS DISTINCT FROM target.updated_at THEN RAISE EXCEPTION 'La cuenta cambió. Recarga su ficha antes de eliminarla.' USING ERRCODE='40001'; END IF;
 UPDATE public.profiles SET active=false,deleted_at=clock_timestamp(),deleted_by=actor.id WHERE id=p_id;
 UPDATE public.judge_assignments SET active=false WHERE judge_id=p_id AND active;
 RETURN p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.roboscore_delete_judge(uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roboscore_delete_judge(uuid,timestamptz) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
