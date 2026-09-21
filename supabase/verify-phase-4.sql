-- Solo lectura. Resultado esperado: todos los checks tienen passed = true.
WITH profile_table AS (
  SELECT c.oid, c.relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='profiles' AND c.relkind='r'
)
SELECT '01. Tabla profiles y RLS' AS check_name,
       EXISTS (SELECT 1 FROM profile_table WHERE relrowsecurity) AS passed
UNION ALL
SELECT '02. Tres roles correctos',
  (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
   FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
   JOIN pg_namespace n ON n.oid=t.typnamespace
   WHERE n.nspname='public' AND t.typname='user_role') = ARRAY['SUPER_ADMIN','ADMIN','JUDGE']
UNION ALL
SELECT '03. Trigger de creación y sincronización de correo',
  (SELECT count(*)=2 FROM pg_trigger WHERE tgrelid='auth.users'::regclass
   AND tgname IN ('roboscore_auth_user_created','roboscore_auth_email_updated') AND tgenabled='O')
UNION ALL
SELECT '04. Todos los usuarios Auth tienen perfil',
  NOT EXISTS (SELECT 1 FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id WHERE p.id IS NULL)
UNION ALL
SELECT '05. Dos policies de lectura para authenticated',
  (SELECT count(*)=2 FROM pg_policies WHERE schemaname='public' AND tablename='profiles'
   AND cmd='SELECT' AND roles=ARRAY['authenticated']::name[])
UNION ALL
SELECT '06. Cliente sin permisos de escritura',
  NOT EXISTS (SELECT 1 FROM unnest(ARRAY['anon','authenticated']) r(role_name)
   CROSS JOIN unnest(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) v(privilege_name)
   CROSS JOIN profile_table p WHERE has_table_privilege(r.role_name,p.oid,v.privilege_name))
UNION ALL
SELECT '07. Anon sin lectura; authenticated con lectura sujeta a RLS',
  (SELECT NOT has_table_privilege('anon',oid,'SELECT') AND has_table_privilege('authenticated',oid,'SELECT') FROM profile_table)
UNION ALL
SELECT '08. Referencias de negocio a profiles',
  (SELECT count(*)=4 FROM pg_constraint WHERE contype='f' AND confrelid='public.profiles'::regclass
   AND conname IN ('events_creator_profile_fk','assignments_judge_profile_fk','assignments_assigner_profile_fk','participants_creator_profile_fk'))
UNION ALL
SELECT '09. Timestamp automático',
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.profiles'::regclass AND tgname='set_updated_at' AND tgenabled='O')
ORDER BY check_name;
