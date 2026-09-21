SELECT '01. Campos de eliminación' AS check_name,
 (SELECT count(*)=2 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name IN('deleted_at','deleted_by')) AS passed
UNION ALL SELECT '02. Función disponible solo con sesión',
 has_function_privilege('authenticated','public.roboscore_delete_judge(uuid,timestamptz)','EXECUTE') AND NOT has_function_privilege('anon','public.roboscore_delete_judge(uuid,timestamptz)','EXECUTE')
UNION ALL SELECT '03. Protección contra reactivación',
 EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.profiles'::regclass AND tgname='roboscore_protect_deleted_profile' AND tgenabled='O')
UNION ALL SELECT '04. Sin eliminación directa de perfiles',
 NOT has_table_privilege('authenticated','public.profiles','DELETE')
ORDER BY check_name;
