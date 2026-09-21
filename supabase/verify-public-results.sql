-- Solo lectura. Las cuatro filas deben mostrar true.
SELECT '01. Consulta pública instalada' AS check_name,
 EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='roboscore_public_results' AND p.prosecdef AND p.pronargs=0) AS passed
UNION ALL SELECT '02. Lectura disponible para visitantes',
 has_function_privilege('anon','public.roboscore_public_results()','EXECUTE') AND has_function_privilege('authenticated','public.roboscore_public_results()','EXECUTE')
UNION ALL SELECT '03. Tablas originales siguen protegidas',
 NOT has_table_privilege('anon','public.teams','SELECT,INSERT,UPDATE,DELETE') AND NOT has_table_privilege('anon','public.team_scores','SELECT,INSERT,UPDATE,DELETE')
UNION ALL SELECT '04. Respuesta de eventos, categorías y equipos',
 public.roboscore_public_results() ?& ARRAY['events','categories','teams']
ORDER BY check_name;
