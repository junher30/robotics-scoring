-- Ejecutar después de 202609200001_admin_dashboard.sql.
-- Todos los valores passed deben ser true. No llama al resumen sin sesión.
SELECT '01. Función del dashboard instalada' AS check_name,
  to_regprocedure('public.admin_dashboard()') IS NOT NULL AS passed
UNION ALL
SELECT '02. Visitantes sin permiso de ejecución',
  NOT has_function_privilege('anon','public.admin_dashboard()','EXECUTE')
UNION ALL
SELECT '03. Autenticados pueden llamar; la función valida rol y actividad',
  has_function_privilege('authenticated','public.admin_dashboard()','EXECUTE')
UNION ALL
SELECT '04. Función con search_path fijo y solo lectura',
  EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.admin_dashboard()'::regprocedure
    AND prosecdef AND provolatile='s' AND proconfig @> ARRAY['search_path=""'])
UNION ALL
SELECT '05. Tablas de negocio siguen con RLS',
  bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.events'::regclass,'public.teams'::regclass,'public.participants'::regclass,'public.judge_assignments'::regclass,'public.team_members'::regclass)
ORDER BY check_name;
