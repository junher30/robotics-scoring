-- RoboScore FASE 4. Ejecutar UNA VEZ después de la fase 3.
-- No crea cuentas, no cambia contraseñas y no importa datos del Excel.
BEGIN;

CREATE TYPE public.user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'JUDGE');
CREATE SCHEMA IF NOT EXISTS roboscore_private;
REVOKE ALL ON SCHEMA roboscore_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA roboscore_private TO authenticated;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  first_name text NOT NULL DEFAULT '' CHECK (length(first_name) <= 100),
  last_name text NOT NULL DEFAULT '' CHECK (length(last_name) <= 150),
  email text,
  role public.user_role NOT NULL DEFAULT 'JUDGE',
  phone text,
  avatar_url text,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
CREATE INDEX profiles_role_active_idx ON public.profiles(role, active);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.roboscore_set_updated_at();

-- Solo auth.users determina el correo. Ignoramos role y active en metadatos
-- porque una persona puede modificar sus propios user_metadata.
CREATE FUNCTION roboscore_private.create_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles(id, first_name, last_name, email)
  VALUES (
    NEW.id,
    left(coalesce(NEW.raw_user_meta_data ->> 'first_name', ''), 100),
    left(coalesce(NEW.raw_user_meta_data ->> 'last_name', ''), 150),
    NEW.email
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION roboscore_private.create_profile() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER roboscore_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION roboscore_private.create_profile();

CREATE FUNCTION roboscore_private.sync_profile_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION roboscore_private.sync_profile_email() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER roboscore_auth_email_updated AFTER UPDATE OF email ON auth.users
FOR EACH ROW WHEN (OLD.email IS DISTINCT FROM NEW.email)
EXECUTE FUNCTION roboscore_private.sync_profile_email();

-- Usuarios previos reciben un perfil sin privilegios administrativos.
INSERT INTO public.profiles(id, first_name, last_name, email)
SELECT id,
       left(coalesce(raw_user_meta_data ->> 'first_name', ''), 100),
       left(coalesce(raw_user_meta_data ->> 'last_name', ''), 150),
       email
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Se comprueba el rol guardado en la BD, no un rol enviado por el navegador.
-- La función privada evita consultar profiles recursivamente dentro de RLS.
CREATE FUNCTION roboscore_private.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'SUPER_ADMIN' AND active = true
  );
$$;
REVOKE ALL ON FUNCTION roboscore_private.is_super_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION roboscore_private.is_super_admin() TO authenticated;

-- Política 1: cada sesión puede leer su propio perfil, incluso inactivo,
-- para que el futuro login pueda mostrar que la cuenta está desactivada.
CREATE POLICY profiles_read_self ON public.profiles FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()));
-- Política 2: solo un SUPER_ADMIN activo puede consultar todos los perfiles.
CREATE POLICY profiles_read_super_admin ON public.profiles FOR SELECT TO authenticated
USING ((SELECT roboscore_private.is_super_admin()));
-- Nadie puede insertar, actualizar o borrar perfiles directamente desde el cliente.
-- La gestión administrativa se incorporará por servidor con validación y auditoría.

-- Completa las referencias a profiles conservando también las de auth.users.
ALTER TABLE public.events ADD CONSTRAINT events_creator_profile_fk
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;
ALTER TABLE public.judge_assignments ADD CONSTRAINT assignments_judge_profile_fk
  FOREIGN KEY (judge_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
ALTER TABLE public.judge_assignments ADD CONSTRAINT assignments_assigner_profile_fk
  FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;
ALTER TABLE public.participants ADD CONSTRAINT participants_creator_profile_fk
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

COMMENT ON TABLE public.profiles IS 'Perfil vinculado a Auth. Nuevos usuarios: JUDGE inactivo. No confundir cuenta de Auth con autorización de RoboScore.';
COMMENT ON SCHEMA roboscore_private IS 'Funciones internas de RoboScore. No añadir este esquema a los esquemas expuestos por Data API.';
COMMIT;
