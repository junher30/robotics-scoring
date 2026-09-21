-- FASE 5: ejecutar SOLO en SQL Editor como postgres.
-- No es una migración ni una función pública. No guarda contraseñas.
-- UUID y correo configurados con los datos proporcionados por el propietario.
BEGIN;
DO $$
DECLARE
  target_id uuid := '476425ff-e684-46ee-ba28-07df532ce9bf';
  expected_email text := 'josegre301@gmail.com';
  account auth.users%ROWTYPE;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Ejecuta este archivo desde SQL Editor con rol postgres.';
  END IF;
  IF target_id = '00000000-0000-0000-0000-000000000000'::uuid
     OR expected_email = 'REEMPLAZAR_CORREO' THEN
    RAISE EXCEPTION 'Primero reemplaza target_id y expected_email con los datos de tu cuenta.';
  END IF;
  -- Bloquea altas simultáneas de un primer administrador.
  LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;
  SELECT * INTO account FROM auth.users WHERE id = target_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No existe esa cuenta en Authentication > Users.'; END IF;
  IF account.email IS NULL OR lower(account.email) <> lower(btrim(expected_email)) THEN
    RAISE EXCEPTION 'El UUID y el correo no corresponden a la misma cuenta.';
  END IF;
  IF account.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'La cuenta debe tener el correo confirmado antes de continuar.';
  END IF;
  IF coalesce(account.is_anonymous, false) THEN
    RAISE EXCEPTION 'Una cuenta anónima no puede ser superadministrador.';
  END IF;
  IF account.banned_until IS NOT NULL AND account.banned_until > now() THEN
    RAISE EXCEPTION 'La cuenta está bloqueada en Supabase Auth.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=target_id) THEN
    RAISE EXCEPTION 'Falta profiles. Revisa la fase 4; no crees el perfil manualmente.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE role='SUPER_ADMIN' AND id<>target_id) THEN
    RAISE EXCEPTION 'Ya existe otro SUPER_ADMIN. Este archivo solo permite preparar el primero.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id=target_id AND role='SUPER_ADMIN') THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id=target_id AND active) THEN
      RAISE NOTICE 'Esta cuenta ya es SUPER_ADMIN activo. No se modificó.';
      RETURN;
    END IF;
    RAISE EXCEPTION 'El SUPER_ADMIN existe pero está desactivado. No se reactiva con este archivo.';
  END IF;
  UPDATE public.profiles SET role='SUPER_ADMIN', active=true WHERE id=target_id;
END;
$$;
COMMIT;
