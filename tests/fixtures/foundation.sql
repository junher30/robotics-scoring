-- RoboScore / Fase 3. Ejecutar UNA VEZ en un proyecto Supabase nuevo.
-- No importa datos personales ni resuelve las fórmulas discrepantes del Excel.
-- Si hay un error, toda esta transacción se revierte. No borra tablas existentes.
BEGIN;

CREATE TYPE public.event_status AS ENUM ('DRAFT', 'REGISTRATION', 'ACTIVE', 'FINISHED', 'CANCELLED');
CREATE TYPE public.category_status AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');
CREATE TYPE public.team_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE');
CREATE TYPE public.team_member_role AS ENUM ('CAPTAIN', 'MEMBER');

-- Se ejecuta automáticamente antes de modificar una fila.
CREATE FUNCTION public.roboscore_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.roboscore_set_updated_at() FROM PUBLIC, anon, authenticated;

-- auth.users existe en Supabase. En fase 4 profiles usará esos mismos UUID.
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 150),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  registration_start timestamptz,
  registration_end timestamptz,
  location text,
  city text,
  address text,
  status public.event_status NOT NULL DEFAULT 'DRAFT',
  logo_url text,
  banner_url text,
  organizer_name text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  max_teams integer CHECK (max_teams > 0),
  rules_url text,
  public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_dates_order CHECK (end_date >= start_date),
  CONSTRAINT registration_dates_pair CHECK ((registration_start IS NULL) = (registration_end IS NULL)),
  CONSTRAINT registration_dates_order CHECK (registration_end >= registration_start),
  CONSTRAINT registration_before_event_end CHECK (registration_end <= end_date)
);

CREATE TABLE public.event_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  description text,
  max_teams integer CHECK (max_teams > 0),
  status public.category_status NOT NULL DEFAULT 'DRAFT',
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, id)
);
CREATE UNIQUE INDEX categories_event_name_unique ON public.event_categories(event_id, lower(btrim(name)));

-- Un reto es una prueba dentro de una categoría: no equivale a un intento.
-- No fijamos 3 o 4 columnas: cada categoría puede tener sus propios retos.
CREATE TABLE public.event_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  category_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  description text,
  sort_order integer NOT NULL CHECK (sort_order > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT challenge_category_same_event FOREIGN KEY (event_id, category_id)
    REFERENCES public.event_categories(event_id, id) ON DELETE RESTRICT,
  UNIQUE (category_id, sort_order)
);

CREATE TABLE public.judge_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  judge_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  category_id uuid NOT NULL,
  assigned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT judge_category_same_event FOREIGN KEY (event_id, category_id)
    REFERENCES public.event_categories(event_id, id) ON DELETE RESTRICT,
  UNIQUE (judge_id, category_id)
);

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  category_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 150),
  institution text NOT NULL CHECK (length(btrim(institution)) BETWEEN 1 AND 200),
  robot_name text,
  coach_name text,
  coach_email text,
  coach_phone text,
  logo_url text,
  registration_code text NOT NULL DEFAULT ('RK-' || gen_random_uuid()::text),
  status public.team_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_category_same_event FOREIGN KEY (event_id, category_id)
    REFERENCES public.event_categories(event_id, id) ON DELETE RESTRICT,
  UNIQUE (event_id, registration_code),
  CHECK (length(btrim(registration_code)) > 0)
);

CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL CHECK (length(btrim(first_name)) BETWEEN 1 AND 100),
  last_name text NOT NULL CHECK (length(btrim(last_name)) BETWEEN 1 AND 150),
  email text,
  phone text,
  institution text,
  birth_date date,
  document_type text,
  document_number text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT participant_document_pair CHECK ((document_type IS NULL) = (document_number IS NULL)),
  CONSTRAINT participant_document_nonempty CHECK (
    document_type IS NULL OR (length(btrim(document_type)) > 0 AND length(btrim(document_number)) > 0)
  )
);

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE RESTRICT,
  role public.team_member_role NOT NULL DEFAULT 'MEMBER',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, participant_id)
);

CREATE INDEX events_status_idx ON public.events(status);
CREATE INDEX events_created_by_idx ON public.events(created_by);
CREATE INDEX events_start_date_idx ON public.events(start_date);
CREATE INDEX event_challenges_event_idx ON public.event_challenges(event_id);
CREATE INDEX judge_assignments_judge_idx ON public.judge_assignments(judge_id);
CREATE INDEX judge_assignments_event_idx ON public.judge_assignments(event_id);
CREATE INDEX judge_assignments_category_idx ON public.judge_assignments(category_id);
CREATE INDEX judge_assignments_assigned_by_idx ON public.judge_assignments(assigned_by);
CREATE INDEX teams_event_idx ON public.teams(event_id);
CREATE INDEX teams_category_idx ON public.teams(category_id);
CREATE INDEX participants_created_by_idx ON public.participants(created_by);
CREATE INDEX team_members_participant_idx ON public.team_members(participant_id);
-- Los UNIQUE ya indexan event_categories.event_id, event_challenges.category_id
-- y team_members.team_id como primera columna. No duplicamos esos índices.

-- Seguridad inicial: ningún acceso desde la aplicación hasta implementar roles.
-- No hay policies permisivas temporales. No se concede acceso público a menores.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'events', 'event_categories', 'event_challenges', 'judge_assignments',
    'teams', 'participants', 'team_members'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.roboscore_set_updated_at()',
      table_name
    );
  END LOOP;
END;
$$;

COMMENT ON TABLE public.event_challenges IS 'Retos variables por categoría. Reglas, intentos y resultados se incorporarán después de conciliar las variantes del Excel.';
COMMENT ON TABLE public.judge_assignments IS 'Fase 3: estructura cerrada. Antes de habilitar escrituras, validar perfil JUDGE activo y permisos del asignador.';
COMMENT ON TABLE public.participants IS 'Datos privados. No exponer en rankings públicos.';
COMMENT ON COLUMN public.events.max_teams IS 'Capacidad configurada; su cumplimiento transaccional se añadirá al implementar inscripciones.';
COMMENT ON COLUMN public.events.public IS 'Intención de publicación. En fase 3 no habilita lectura por API.';

COMMIT;
