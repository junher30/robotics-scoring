SELECT '01. Perfiles con RLS' AS check_name,relrowsecurity AS passed FROM pg_class WHERE oid='public.profiles'::regclass
UNION ALL
SELECT '02. Responsable de la cuenta',EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='managed_by')
UNION ALL
SELECT '03. Lectura de jueces propios',EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_read_managed_judges')
UNION ALL
SELECT '04. Sin escritura directa de perfiles',NOT has_any_column_privilege('authenticated','public.profiles','INSERT') AND NOT has_any_column_privilege('authenticated','public.profiles','UPDATE') AND NOT has_table_privilege('authenticated','public.profiles','DELETE')
UNION ALL
SELECT '05. Invitaciones privadas con RLS',relrowsecurity AND NOT has_table_privilege('anon','roboscore_private.user_invitations','SELECT') AND NOT has_table_privilege('authenticated','roboscore_private.user_invitations','SELECT') FROM pg_class WHERE oid='roboscore_private.user_invitations'::regclass
UNION ALL
SELECT '06. Preparación limitada a sesiones autenticadas',has_function_privilege('authenticated','public.roboscore_prepare_user_invitation(text,text,text,text,public.user_role)','EXECUTE') AND NOT has_function_privilege('anon','public.roboscore_prepare_user_invitation(text,text,text,text,public.user_role)','EXECUTE')
UNION ALL
SELECT '07. Edición limitada a sesiones autenticadas',has_function_privilege('authenticated','public.roboscore_update_managed_user(uuid,timestamptz,text,text,text,public.user_role,boolean)','EXECUTE') AND NOT has_function_privilege('anon','public.roboscore_update_managed_user(uuid,timestamptz,text,text,text,public.user_role,boolean)','EXECUTE')
UNION ALL
SELECT '08. Funciones con search_path fijo',count(*)=3 AND bool_and(prosecdef AND coalesce(array_to_string(proconfig,',') LIKE '%search_path=%',false)) FROM pg_proc WHERE oid IN ('public.roboscore_prepare_user_invitation(text,text,text,text,public.user_role)'::regprocedure,'public.roboscore_update_managed_user(uuid,timestamptz,text,text,text,public.user_role,boolean)'::regprocedure,'roboscore_private.create_profile()'::regprocedure)
ORDER BY check_name;
