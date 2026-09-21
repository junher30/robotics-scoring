-- Solo lectura. Ejecutar en SQL Editor después de la migración.
-- Resultado esperado: siete filas, rls_enabled=true, access_locked=true,
-- timestamps_enabled=true, policies_count=0.
WITH expected(table_name) AS (
  VALUES ('events'), ('event_categories'), ('event_challenges'),
         ('judge_assignments'), ('teams'), ('participants'), ('team_members')
)
SELECT e.table_name,
       c.oid IS NOT NULL AS table_exists,
       coalesce(c.relrowsecurity, false) AS rls_enabled,
       CASE WHEN c.oid IS NULL THEN false ELSE
         NOT EXISTS (
           SELECT 1 FROM unnest(ARRAY['anon', 'authenticated']) AS r(role_name)
           CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) AS p(privilege_name)
           WHERE has_table_privilege(r.role_name, c.oid, p.privilege_name)
         ) END AS access_locked,
       EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid=c.oid AND t.tgname='set_updated_at' AND NOT t.tgisinternal) AS timestamps_enabled,
       (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=e.table_name) AS policies_count
FROM expected e
LEFT JOIN pg_namespace n ON n.nspname='public'
LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=e.table_name AND c.relkind='r'
ORDER BY e.table_name;
