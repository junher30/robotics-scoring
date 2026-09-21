SELECT '01. Funciones de asignación y lectura' AS check_name,
 (SELECT count(*)=5 AND bool_and(p.prosecdef AND has_function_privilege('authenticated',p.oid,'EXECUTE') AND NOT has_function_privilege('anon',p.oid,'EXECUTE')) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('roboscore_assign_judge','roboscore_event_judges','roboscore_judge_home','roboscore_judge_category','roboscore_judge_team')) AS passed
UNION ALL SELECT '02. Guardado comprueba asignación',
 position('judge_can_score' IN pg_get_functiondef('public.roboscore_save_score(uuid,uuid,uuid,timestamptz,integer,numeric,boolean,text)'::regprocedure))>0
UNION ALL SELECT '03. Sin escritura directa de puntuaciones',
 NOT has_table_privilege('authenticated','public.team_scores','INSERT,UPDATE,DELETE')
UNION ALL SELECT '04. Historial y RLS conservados',
 (SELECT count(*)=2 AND bool_and(relrowsecurity) FROM pg_class WHERE oid IN('public.team_scores'::regclass,'public.score_revisions'::regclass))
ORDER BY check_name;
