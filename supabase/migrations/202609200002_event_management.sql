-- FASE 9. Repetible; no borra eventos ni modifica las otras tablas.
BEGIN;
CREATE OR REPLACE FUNCTION roboscore_private.is_event_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id=(SELECT auth.uid()) AND active AND role IN ('ADMIN','SUPER_ADMIN'));
$$;
REVOKE ALL ON FUNCTION roboscore_private.is_event_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION roboscore_private.is_event_admin() TO authenticated;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.events TO authenticated;
GRANT INSERT (id,name,slug,description,start_date,end_date,registration_start,registration_end,location,city,address,status,logo_url,organizer_name,created_by,max_teams,rules_url,public) ON public.events TO authenticated;
GRANT UPDATE (name,description,start_date,end_date,registration_start,registration_end,location,city,address,status,logo_url,organizer_name,max_teams,rules_url,public) ON public.events TO authenticated;
DROP POLICY IF EXISTS events_admin_read ON public.events;
CREATE POLICY events_admin_read ON public.events FOR SELECT TO authenticated
USING ((SELECT roboscore_private.is_event_admin()) AND (created_by=(SELECT auth.uid()) OR (SELECT roboscore_private.is_super_admin())));
DROP POLICY IF EXISTS events_admin_create ON public.events;
CREATE POLICY events_admin_create ON public.events FOR INSERT TO authenticated
WITH CHECK ((SELECT roboscore_private.is_event_admin()) AND created_by=(SELECT auth.uid()));
DROP POLICY IF EXISTS events_admin_update ON public.events;
CREATE POLICY events_admin_update ON public.events FOR UPDATE TO authenticated
USING ((SELECT roboscore_private.is_event_admin()) AND (created_by=(SELECT auth.uid()) OR (SELECT roboscore_private.is_super_admin())))
WITH CHECK ((SELECT roboscore_private.is_event_admin()) AND (created_by=(SELECT auth.uid()) OR (SELECT roboscore_private.is_super_admin())));
-- No DELETE. No permisos UPDATE para created_by/id/slug/timestamps.
-- public=true no abre lectura a visitantes ni jueces en esta fase.
NOTIFY pgrst, 'reload schema';
COMMIT;
