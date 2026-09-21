SELECT '01. Categorías con RLS' AS check_name, relrowsecurity AS passed
FROM pg_class WHERE oid='public.event_categories'::regclass
UNION ALL
SELECT '02. Tres políticas administrativas', count(*)=3 FROM pg_policies
WHERE schemaname='public' AND tablename='event_categories'
  AND policyname IN ('categories_admin_read','categories_admin_create','categories_admin_update')
UNION ALL
SELECT '03. Lectura authenticated sujeta a RLS', has_table_privilege('authenticated','public.event_categories','SELECT')
UNION ALL
SELECT '04. Escritura de campos autorizados', has_column_privilege('authenticated','public.event_categories','name','INSERT') AND has_column_privilege('authenticated','public.event_categories','sort_order','UPDATE')
UNION ALL
SELECT '05. Categoría y evento inmutables', NOT has_column_privilege('authenticated','public.event_categories','id','UPDATE') AND NOT has_column_privilege('authenticated','public.event_categories','event_id','UPDATE')
UNION ALL
SELECT '06. Sin borrado permanente', NOT has_table_privilege('authenticated','public.event_categories','DELETE')
UNION ALL
SELECT '07. Visitantes sin lectura ni escritura', NOT has_table_privilege('anon','public.event_categories','SELECT') AND NOT has_any_column_privilege('anon','public.event_categories','INSERT') AND NOT has_any_column_privilege('anon','public.event_categories','UPDATE')
UNION ALL
SELECT '08. Nombres únicos por evento', EXISTS (SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('public.categories_event_name_unique') AND indisunique AND indisvalid)
ORDER BY check_name;
