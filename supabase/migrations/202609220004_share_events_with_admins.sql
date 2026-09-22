-- Permite que un ADMIN comparta un evento con el resto de administradores para que
-- lo vean y lo gestionen igual que su propio evento. Distinto de "public" (que
-- controla la visibilidad en el tablero público, para cualquier visitante). El
-- SUPER_ADMIN siempre ve y gestiona todos los eventos, se comparta o no.
-- Repetible; requiere 202609200002_event_management.sql.
BEGIN;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS shared_with_admins boolean NOT NULL DEFAULT false;
GRANT INSERT (shared_with_admins) ON public.events TO authenticated;
GRANT UPDATE (shared_with_admins) ON public.events TO authenticated;

CREATE OR REPLACE FUNCTION roboscore_private.can_manage_event(p_event uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.events e JOIN public.profiles p ON p.id=auth.uid()
 WHERE e.id=p_event AND p.active AND (p.role='SUPER_ADMIN' OR (p.role='ADMIN' AND (e.created_by=p.id OR e.shared_with_admins))));
$$;

DROP POLICY IF EXISTS events_admin_read ON public.events;
CREATE POLICY events_admin_read ON public.events FOR SELECT TO authenticated
USING ((SELECT roboscore_private.is_event_admin()) AND (created_by=(SELECT auth.uid()) OR shared_with_admins OR (SELECT roboscore_private.is_super_admin())));
DROP POLICY IF EXISTS events_admin_update ON public.events;
CREATE POLICY events_admin_update ON public.events FOR UPDATE TO authenticated
USING ((SELECT roboscore_private.is_event_admin()) AND (created_by=(SELECT auth.uid()) OR shared_with_admins OR (SELECT roboscore_private.is_super_admin())))
WITH CHECK ((SELECT roboscore_private.is_event_admin()) AND (created_by=(SELECT auth.uid()) OR shared_with_admins OR (SELECT roboscore_private.is_super_admin())));
-- events_admin_create no cambia: seguir creando siempre queda a nombre de quien crea.

-- Las categorías heredan la regla de eventos a través de can_manage_event, en vez de
-- repetir la condición de "created_by" por separado (así comparten automáticamente
-- cualquier evento marcado shared_with_admins).
DROP POLICY IF EXISTS categories_admin_read ON public.event_categories;
CREATE POLICY categories_admin_read ON public.event_categories FOR SELECT TO authenticated
USING (roboscore_private.can_manage_event(event_id));
DROP POLICY IF EXISTS categories_admin_create ON public.event_categories;
CREATE POLICY categories_admin_create ON public.event_categories FOR INSERT TO authenticated
WITH CHECK (roboscore_private.can_manage_event(event_id));
DROP POLICY IF EXISTS categories_admin_update ON public.event_categories;
CREATE POLICY categories_admin_update ON public.event_categories FOR UPDATE TO authenticated
USING (roboscore_private.can_manage_event(event_id)) WITH CHECK (roboscore_private.can_manage_event(event_id));
NOTIFY pgrst,'reload schema';
COMMIT;
