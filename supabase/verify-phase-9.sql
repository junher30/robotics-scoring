-- Todos los resultados deben ser true después de instalar la fase 9.
SELECT '01. Events mantiene RLS' AS check_name, relrowsecurity AS passed
FROM pg_class WHERE oid='public.events'::regclass
UNION ALL
SELECT '02. Tres políticas administrativas instaladas',count(*)=3 FROM pg_policies
WHERE schemaname='public' AND tablename='events' AND policyname IN ('events_admin_read','events_admin_create','events_admin_update')
UNION ALL
SELECT '03. Lectura authenticated sujeta a RLS',has_table_privilege('authenticated','public.events','SELECT')
UNION ALL
SELECT '04. Escritura de campos permitidos',has_column_privilege('authenticated','public.events','name','INSERT') AND has_column_privilege('authenticated','public.events','name','UPDATE')
UNION ALL
SELECT '05. Propietario e identificadores inmutables',NOT has_column_privilege('authenticated','public.events','created_by','UPDATE') AND NOT has_column_privilege('authenticated','public.events','id','UPDATE') AND NOT has_column_privilege('authenticated','public.events','slug','UPDATE')
UNION ALL
SELECT '06. Sin borrado permanente',NOT has_table_privilege('authenticated','public.events','DELETE')
UNION ALL
SELECT '07. Anon sin lectura ni escritura',NOT has_table_privilege('anon','public.events','SELECT') AND NOT has_any_column_privilege('anon','public.events','INSERT') AND NOT has_any_column_privilege('anon','public.events','UPDATE')
UNION ALL
SELECT '08. Helper limitado a autenticados',has_function_privilege('authenticated','roboscore_private.is_event_admin()','EXECUTE') AND NOT has_function_privilege('anon','roboscore_private.is_event_admin()','EXECUTE')
ORDER BY check_name;
