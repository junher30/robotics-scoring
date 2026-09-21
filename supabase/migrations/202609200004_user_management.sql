-- FASE 11. Repetible; requiere perfiles (fase 4) y permisos de eventos (fase 9).
-- No envía correos, no cambia cuentas existentes y no desactiva RLS.
BEGIN;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS managed_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS profiles_manager_role_idx ON public.profiles(managed_by,role);

CREATE TABLE IF NOT EXISTS roboscore_private.user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  role public.user_role NOT NULL CHECK (role IN ('ADMIN','JUDGE')),
  invited_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  user_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  last_attempt_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE roboscore_private.user_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON roboscore_private.user_invitations FROM PUBLIC,anon,authenticated;

DROP POLICY IF EXISTS profiles_read_managed_judges ON public.profiles;
CREATE POLICY profiles_read_managed_judges ON public.profiles FOR SELECT TO authenticated
USING (role='JUDGE' AND managed_by=(SELECT auth.uid()) AND (SELECT roboscore_private.is_event_admin()));
-- Conserva las políticas de lectura propia y del superadministrador de la fase 4.
-- Sin INSERT/UPDATE/DELETE directo: los cambios pasan por funciones controladas.

CREATE OR REPLACE FUNCTION public.roboscore_prepare_user_invitation(
  p_email text,p_first_name text,p_last_name text,p_phone text,p_role public.user_role
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  invitation roboscore_private.user_invitations%ROWTYPE;
  normalized_email text := lower(btrim(p_email));
BEGIN
  SELECT * INTO actor FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
  IF NOT FOUND OR NOT actor.active OR actor.role NOT IN ('SUPER_ADMIN','ADMIN') THEN
    RAISE EXCEPTION 'No tienes permisos.' USING ERRCODE='42501';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('ADMIN','JUDGE') OR (p_role='ADMIN' AND actor.role<>'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Solo el superadministrador puede invitar administradores.' USING ERRCODE='42501';
  END IF;
  IF normalized_email IS NULL OR length(normalized_email)>254 OR normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR coalesce(length(btrim(p_first_name)),0) NOT BETWEEN 1 AND 100
    OR coalesce(length(btrim(p_last_name)),0) NOT BETWEEN 1 AND 150
    OR coalesce(length(p_phone),0)>40 THEN
    RAISE EXCEPTION 'Datos de invitación no válidos.' USING ERRCODE='22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(normalized_email,0));
  SELECT * INTO invitation FROM roboscore_private.user_invitations WHERE email=normalized_email FOR UPDATE;
  IF FOUND THEN
    IF invitation.invited_by<>actor.id AND actor.role<>'SUPER_ADMIN' THEN
      RAISE EXCEPTION 'El correo ya está en uso o no puede invitarse desde esta cuenta.' USING ERRCODE='42501';
    END IF;
    IF invitation.role<>p_role THEN
      RAISE EXCEPTION 'Ya existe una invitación con otro rol. Revisa la ficha del usuario.' USING ERRCODE='22023';
    END IF;
    IF invitation.user_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM auth.users u JOIN public.profiles p ON p.id=u.id
      WHERE u.id=invitation.user_id AND lower(u.email)=normalized_email
        AND u.email_confirmed_at IS NULL AND p.active AND p.role=invitation.role
    ) THEN
      RAISE EXCEPTION 'La cuenta ya existe. Gestiona sus datos desde el listado.' USING ERRCODE='23505';
    END IF;
    IF invitation.last_attempt_at>now()-interval '60 seconds' THEN
      RAISE EXCEPTION 'Espera un minuto antes de volver a enviar la invitación.' USING ERRCODE='P0001';
    END IF;
    UPDATE roboscore_private.user_invitations SET last_attempt_at=now(),expires_at=now()+interval '15 minutes'
      WHERE id=invitation.id;
    RETURN invitation.id;
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email)=normalized_email) THEN
    RAISE EXCEPTION 'El correo ya está en uso. Revisa el listado de usuarios.' USING ERRCODE='23505';
  END IF;
  IF (SELECT count(*) FROM roboscore_private.user_invitations WHERE invited_by=actor.id AND last_attempt_at>now()-interval '1 hour')>=20 THEN
    RAISE EXCEPTION 'Alcanzaste el límite de invitaciones. Intenta más tarde.' USING ERRCODE='P0001';
  END IF;
  INSERT INTO roboscore_private.user_invitations(email,first_name,last_name,phone,role,invited_by,expires_at)
    VALUES(normalized_email,btrim(p_first_name),btrim(p_last_name),nullif(btrim(p_phone),''),p_role,actor.id,now()+interval '15 minutes')
    RETURNING id INTO invitation.id;
  RETURN invitation.id;
END;
$$;
REVOKE ALL ON FUNCTION public.roboscore_prepare_user_invitation(text,text,text,text,public.user_role) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roboscore_prepare_user_invitation(text,text,text,text,public.user_role) TO authenticated;

-- Un rol nunca se obtiene de user_metadata. Solo de una reserva privada autorizada,
-- vinculada al correo y creada antes de llamar al servicio de invitaciones de Auth.
CREATE OR REPLACE FUNCTION roboscore_private.create_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE invitation roboscore_private.user_invitations%ROWTYPE;
BEGIN
  SELECT * INTO invitation FROM roboscore_private.user_invitations
    WHERE email=lower(NEW.email) AND user_id IS NULL AND expires_at>now()
      AND id::text=NEW.raw_user_meta_data->>'roboscore_invitation_id' FOR UPDATE;
  IF FOUND THEN
    PERFORM 1 FROM public.profiles WHERE id=invitation.invited_by AND active
      AND (role='SUPER_ADMIN' OR (role='ADMIN' AND invitation.role='JUDGE')) FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La invitación ya no está autorizada.' USING ERRCODE='42501'; END IF;
    INSERT INTO public.profiles(id,email,first_name,last_name,phone,role,active,managed_by)
      VALUES(NEW.id,NEW.email,invitation.first_name,invitation.last_name,invitation.phone,invitation.role,true,invitation.invited_by);
    UPDATE roboscore_private.user_invitations SET user_id=NEW.id WHERE id=invitation.id;
  ELSE
    INSERT INTO public.profiles(id,first_name,last_name,email)
      VALUES(NEW.id,left(coalesce(NEW.raw_user_meta_data->>'first_name',''),100),left(coalesce(NEW.raw_user_meta_data->>'last_name',''),150),NEW.email);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION roboscore_private.create_profile() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.roboscore_update_managed_user(
  p_id uuid,p_version timestamptz,p_first_name text,p_last_name text,p_phone text,p_role public.user_role,p_active boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.profiles%ROWTYPE; target public.profiles%ROWTYPE;
BEGIN
  -- Orden estable para serializar ediciones concurrentes y cambios de permisos.
  PERFORM id FROM public.profiles WHERE id IN (auth.uid(),p_id) ORDER BY id FOR UPDATE;
  SELECT * INTO actor FROM public.profiles WHERE id=auth.uid();
  IF NOT FOUND OR NOT actor.active OR actor.role NOT IN ('SUPER_ADMIN','ADMIN') THEN
    RAISE EXCEPTION 'No tienes permisos.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO target FROM public.profiles WHERE id=p_id;
  IF NOT FOUND OR target.id=actor.id OR target.role='SUPER_ADMIN'
    OR (actor.role='ADMIN' AND (target.role<>'JUDGE' OR target.managed_by IS DISTINCT FROM actor.id OR p_role IS DISTINCT FROM 'JUDGE'::public.user_role))
    OR p_role IS NULL OR p_role NOT IN ('ADMIN','JUDGE') THEN
    RAISE EXCEPTION 'No puedes modificar esta cuenta.' USING ERRCODE='42501';
  END IF;
  IF p_version IS DISTINCT FROM target.updated_at THEN
    RAISE EXCEPTION 'La cuenta cambió en otra sesión. Recarga antes de guardar.' USING ERRCODE='40001';
  END IF;
  IF coalesce(length(btrim(p_first_name)),0) NOT BETWEEN 1 AND 100
    OR coalesce(length(btrim(p_last_name)),0) NOT BETWEEN 1 AND 150
    OR coalesce(length(p_phone),0)>40 OR p_active IS NULL THEN
    RAISE EXCEPTION 'Datos de usuario no válidos.' USING ERRCODE='22023';
  END IF;
  UPDATE public.profiles SET first_name=btrim(p_first_name),last_name=btrim(p_last_name),phone=nullif(btrim(p_phone),''),role=p_role,active=p_active WHERE id=p_id;
  RETURN p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.roboscore_update_managed_user(uuid,timestamptz,text,text,text,public.user_role,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.roboscore_update_managed_user(uuid,timestamptz,text,text,text,public.user_role,boolean) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
