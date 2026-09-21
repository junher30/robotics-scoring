-- Solo lectura: ejecutar después de 202609210001_teams_scoring.sql.
WITH tables AS (
 SELECT c.oid,c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('teams','event_challenges','category_scoring','team_scores','score_revisions')
), functions AS (
 SELECT p.oid,p.prosecdef,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('roboscore_save_team','roboscore_configure_scoring','roboscore_save_score','roboscore_scoring_board')
)
SELECT '01. Cinco tablas con RLS' AS check_name,(SELECT count(*)=5 AND bool_and(relrowsecurity) FROM tables) AS passed
UNION ALL SELECT '02. Lectura autenticada y políticas por evento',
 (SELECT count(*)=5 AND bool_and(has_table_privilege('authenticated',oid,'SELECT')) FROM tables)
 AND (SELECT count(*)=5 FROM pg_policies WHERE schemaname='public' AND policyname='scoring_admin_read' AND cmd='SELECT')
UNION ALL SELECT '03. Sin escritura directa del cliente',
 (SELECT count(*)=5 AND bool_and(NOT has_table_privilege('authenticated',oid,'INSERT,UPDATE,DELETE')) FROM tables)
UNION ALL SELECT '04. Tablas sin acceso anónimo',
 (SELECT count(*)=5 AND bool_and(NOT has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE')) FROM tables)
UNION ALL SELECT '05. Cuatro funciones con permisos controlados',
 (SELECT count(*)=4 AND bool_and(prosecdef AND has_function_privilege('authenticated',oid,'EXECUTE') AND NOT has_function_privilege('anon',oid,'EXECUTE') AND array_to_string(proconfig,',') LIKE '%search_path=%') FROM functions)
UNION ALL SELECT '06. Puntos calculados por PostgreSQL',
 EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='team_scores' AND column_name='points' AND is_generated='ALWAYS')
UNION ALL SELECT '07. Equipo y reto vinculados a la misma categoría',
 (SELECT count(*)=2 FROM pg_constraint WHERE conrelid=to_regclass('public.team_scores') AND contype='f' AND array_length(conkey,1)=3)
UNION ALL SELECT '08. Fórmulas del Excel',
 public.roboscore_score_points('EXCEL_2026',1,8.275,true)=161.725
 AND public.roboscore_score_points('EXCEL_2026',0,0,true)=0
 AND public.roboscore_score_points('LEGACY_C',2,30,true)=60
 AND public.roboscore_score_points('LEGACY_D',2,30,true)=120
ORDER BY check_name;
