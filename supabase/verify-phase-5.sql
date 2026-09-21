-- Solo lectura. Debe aparecer UNA fila con los tres checks en true.
-- No devuelve claves, contraseñas ni tokens.
SELECT p.email, p.role, p.active,
       u.email_confirmed_at IS NOT NULL AS email_confirmed,
       NOT coalesce(u.is_anonymous,false) AS regular_account,
       (u.banned_until IS NULL OR u.banned_until <= now()) AS auth_not_banned
FROM public.profiles p
JOIN auth.users u ON u.id=p.id
WHERE p.role='SUPER_ADMIN';
-- Estos resultados no verifican los ajustes del Dashboard ni un login real.
