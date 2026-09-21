-- FASE 10. Repetible. Requiere las fases 3, 4 y 9.
-- No borra categorías ni habilita las tablas de puntuaciones/equipos.
BEGIN;
ALTER TABLE public.event_categories ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.event_categories TO authenticated;
GRANT INSERT (id,event_id,name,description,max_teams,status,sort_order)
  ON public.event_categories TO authenticated;
GRANT UPDATE (name,description,max_teams,status,sort_order)
  ON public.event_categories TO authenticated;

DROP POLICY IF EXISTS categories_admin_read ON public.event_categories;
CREATE POLICY categories_admin_read ON public.event_categories FOR SELECT TO authenticated
USING (
  (SELECT roboscore_private.is_event_admin()) AND EXISTS (
    SELECT 1 FROM public.events e WHERE e.id=event_categories.event_id
      AND (e.created_by=(SELECT auth.uid()) OR (SELECT roboscore_private.is_super_admin()))
  )
);
DROP POLICY IF EXISTS categories_admin_create ON public.event_categories;
CREATE POLICY categories_admin_create ON public.event_categories FOR INSERT TO authenticated
WITH CHECK (
  (SELECT roboscore_private.is_event_admin()) AND EXISTS (
    SELECT 1 FROM public.events e WHERE e.id=event_categories.event_id
      AND (e.created_by=(SELECT auth.uid()) OR (SELECT roboscore_private.is_super_admin()))
  )
);
DROP POLICY IF EXISTS categories_admin_update ON public.event_categories;
CREATE POLICY categories_admin_update ON public.event_categories FOR UPDATE TO authenticated
USING (
  (SELECT roboscore_private.is_event_admin()) AND EXISTS (
    SELECT 1 FROM public.events e WHERE e.id=event_categories.event_id
      AND (e.created_by=(SELECT auth.uid()) OR (SELECT roboscore_private.is_super_admin()))
  )
)
WITH CHECK (
  (SELECT roboscore_private.is_event_admin()) AND EXISTS (
    SELECT 1 FROM public.events e WHERE e.id=event_categories.event_id
      AND (e.created_by=(SELECT auth.uid()) OR (SELECT roboscore_private.is_super_admin()))
  )
);
-- No DELETE ni UPDATE para id/event_id/created_at/updated_at.
-- Los índices y restricciones de la fase 3 evitan nombres duplicados por evento.
NOTIFY pgrst, 'reload schema';
COMMIT;
