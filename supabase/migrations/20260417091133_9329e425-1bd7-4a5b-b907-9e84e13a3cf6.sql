
-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('usuario', 'entrenador', 'superadmin');
CREATE TYPE public.sexo_enum AS ENUM ('masculino', 'femenino', 'unisex');
CREATE TYPE public.mark_value_type AS ENUM ('tiempo', 'distancia', 'repeticiones', 'peso', 'puntuacion', 'booleano', 'texto');
CREATE TYPE public.mark_record_origin AS ENUM ('simulacro', 'manual', 'masivo', 'diario', 'importacion');
CREATE TYPE public.entity_status AS ENUM ('activo', 'inactivo', 'archivado', 'borrador');

-- =====================================================
-- TIMESTAMP HELPER
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- =====================================================
-- PROFILES
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL DEFAULT '',
  apellidos TEXT NOT NULL DEFAULT '',
  email TEXT,
  telefono TEXT,
  fecha_nacimiento DATE,
  sexo public.sexo_enum,
  peso NUMERIC,
  altura NUMERIC,
  notas_internas TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- USER ROLES + has_role
-- =====================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'superadmin');
$$;

CREATE OR REPLACE FUNCTION public.is_coach_or_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'entrenador') OR public.has_role(_user_id, 'superadmin');
$$;

-- =====================================================
-- COACH ASSIGNMENTS
-- =====================================================
CREATE TABLE public.coach_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coach_id, user_id)
);
ALTER TABLE public.coach_assignments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.coach_has_user(_coach_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.coach_assignments WHERE coach_id = _coach_id AND user_id = _user_id);
$$;

-- =====================================================
-- APP SETTINGS (PIN global)
-- =====================================================
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.app_settings(key, value) VALUES ('access_pin', '942');

-- Public function to verify PIN (no exposure of value)
CREATE OR REPLACE FUNCTION public.verify_access_pin(_pin TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_settings WHERE key='access_pin' AND value=_pin);
$$;

-- =====================================================
-- OPOSICIONES
-- =====================================================
CREATE TABLE public.oposiciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  status public.entity_status NOT NULL DEFAULT 'activo',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.oposiciones ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_oposiciones_updated BEFORE UPDATE ON public.oposiciones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_oposiciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  oposicion_id UUID NOT NULL REFERENCES public.oposiciones(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, oposicion_id)
);
ALTER TABLE public.user_oposiciones ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- MARK CATEGORIES + MARKS
-- =====================================================
CREATE TABLE public.mark_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  status public.entity_status NOT NULL DEFAULT 'activo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mark_categories ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_mc_updated BEFORE UPDATE ON public.mark_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.mark_categories(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  value_type public.mark_value_type NOT NULL,
  unidad TEXT,
  formato TEXT,
  admite_decimal BOOLEAN NOT NULL DEFAULT true,
  admite_observaciones BOOLEAN NOT NULL DEFAULT true,
  mejor_mayor BOOLEAN NOT NULL DEFAULT true,
  participa_ranking BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  status public.entity_status NOT NULL DEFAULT 'activo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_marks_updated BEFORE UPDATE ON public.marks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- SIMULACROS
-- =====================================================
CREATE TABLE public.simulacro_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oposicion_id UUID NOT NULL REFERENCES public.oposiciones(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  sexo public.sexo_enum NOT NULL DEFAULT 'unisex',
  status public.entity_status NOT NULL DEFAULT 'borrador',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.simulacro_templates ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_st_updated BEFORE UPDATE ON public.simulacro_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.simulacro_template_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.simulacro_templates(id) ON DELETE CASCADE,
  mark_id UUID NOT NULL REFERENCES public.marks(id) ON DELETE RESTRICT,
  orden INTEGER NOT NULL DEFAULT 0,
  UNIQUE(template_id, mark_id)
);
ALTER TABLE public.simulacro_template_marks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.simulacro_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.simulacro_templates(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES auth.users(id),
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.simulacro_executions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_se_updated BEFORE UPDATE ON public.simulacro_executions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.simulacro_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES public.simulacro_executions(id) ON DELETE CASCADE,
  mark_id UUID NOT NULL REFERENCES public.marks(id) ON DELETE RESTRICT,
  valor_numerico NUMERIC,
  valor_texto TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.simulacro_results ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- MARK RECORDS (histórico unificado)
-- =====================================================
CREATE TABLE public.mark_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mark_id UUID NOT NULL REFERENCES public.marks(id) ON DELETE RESTRICT,
  valor_numerico NUMERIC,
  valor_texto TEXT,
  unidad TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  origen public.mark_record_origin NOT NULL DEFAULT 'manual',
  origen_ref UUID,
  observaciones TEXT,
  registrado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mark_records ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_mark_records_user_mark ON public.mark_records(user_id, mark_id, fecha DESC);

-- =====================================================
-- EXERCISES
-- =====================================================
CREATE TABLE public.exercise_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  status public.entity_status NOT NULL DEFAULT 'activo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exercise_categories ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_ec_updated BEFORE UPDATE ON public.exercise_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.exercise_categories(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  video_url TEXT,
  instrucciones TEXT,
  status public.entity_status NOT NULL DEFAULT 'activo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_ex_updated BEFORE UPDATE ON public.exercises FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- ROUTINES
-- =====================================================
CREATE TABLE public.routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  num_dias INTEGER NOT NULL DEFAULT 1 CHECK (num_dias BETWEEN 1 AND 7),
  status public.entity_status NOT NULL DEFAULT 'activo',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_routines_updated BEFORE UPDATE ON public.routines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.routine_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  dia_num INTEGER NOT NULL CHECK (dia_num BETWEEN 1 AND 7),
  nombre TEXT,
  UNIQUE(routine_id, dia_num)
);
ALTER TABLE public.routine_days ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.routine_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_day_id UUID NOT NULL REFERENCES public.routine_days(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  series INTEGER,
  repeticiones TEXT,
  tiempo TEXT,
  descanso TEXT,
  carga TEXT,
  observaciones TEXT,
  orden INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.routine_exercises ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.routine_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  fecha_inicio DATE,
  fecha_fin DATE,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.routine_assignments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- DIARIO
-- =====================================================
CREATE TABLE public.session_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  status public.entity_status NOT NULL DEFAULT 'activo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.session_types ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.diary_field_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  orden INTEGER NOT NULL DEFAULT 0,
  status public.entity_status NOT NULL DEFAULT 'activo'
);
ALTER TABLE public.diary_field_configs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  session_type_id UUID REFERENCES public.session_types(id),
  descripcion TEXT,
  molestias TEXT,
  completado TEXT,
  marca_clave TEXT,
  observaciones TEXT,
  comentario_entrenador TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_de_updated BEFORE UPDATE ON public.diary_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.diary_entry_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.diary_entries(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.diary_field_configs(id) ON DELETE CASCADE,
  valor TEXT,
  UNIQUE(entry_id, field_id)
);
ALTER TABLE public.diary_entry_values ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ENTRENAMIENTOS PERSONALIZADOS
-- =====================================================
CREATE TABLE public.personalized_trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES auth.users(id),
  titulo TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.personalized_trainings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_pt_updated BEFORE UPDATE ON public.personalized_trainings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.personalized_training_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.personalized_trainings(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  bloques JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(training_id, version)
);
ALTER TABLE public.personalized_training_versions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- FORO + CHAT
-- =====================================================
CREATE TABLE public.forum_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  oposicion_id UUID REFERENCES public.oposiciones(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_ft_updated BEFORE UPDATE ON public.forum_threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.forum_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contenido TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.forum_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.private_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, coach_id)
);
ALTER TABLE public.private_conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.private_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.private_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contenido TEXT NOT NULL,
  leido BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- BULK IMPORTS
-- =====================================================
CREATE TABLE public.bulk_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  test_label TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bulk_imports ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_bi_updated BEFORE UPDATE ON public.bulk_imports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- TRIGGER: nuevo usuario -> perfil + rol usuario
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nombre, apellidos, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    COALESCE(NEW.raw_user_meta_data->>'apellidos', ''),
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'usuario');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- profiles
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_superadmin(auth.uid()) OR (public.is_coach_or_admin(auth.uid()) AND public.coach_has_user(auth.uid(), user_id)));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_superadmin(auth.uid()));
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_superadmin(auth.uid()));
CREATE POLICY "profiles_admin_delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.is_superadmin(auth.uid()));

-- user_roles (solo superadmin gestiona; cualquiera lee los suyos)
CREATE POLICY "roles_self_select" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_superadmin(auth.uid()));
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));

-- coach_assignments
CREATE POLICY "coach_assign_select" ON public.coach_assignments FOR SELECT TO authenticated
  USING (auth.uid() = coach_id OR auth.uid() = user_id OR public.is_superadmin(auth.uid()));
CREATE POLICY "coach_assign_admin" ON public.coach_assignments FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()) OR auth.uid() = coach_id) WITH CHECK (public.is_superadmin(auth.uid()) OR auth.uid() = coach_id);

-- app_settings (solo superadmin)
CREATE POLICY "settings_admin_all" ON public.app_settings FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));

-- oposiciones (lectura todos auth, escritura coach/admin)
CREATE POLICY "opos_select_all" ON public.oposiciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "opos_write_coach" ON public.oposiciones FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid())) WITH CHECK (public.is_coach_or_admin(auth.uid()));

CREATE POLICY "user_opos_select" ON public.user_oposiciones FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_superadmin(auth.uid()) OR (public.is_coach_or_admin(auth.uid()) AND public.coach_has_user(auth.uid(), user_id)));
CREATE POLICY "user_opos_write" ON public.user_oposiciones FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid())) WITH CHECK (public.is_coach_or_admin(auth.uid()));

-- mark_categories / marks (lectura todos auth, escritura coach/admin)
CREATE POLICY "mc_select" ON public.mark_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "mc_write" ON public.mark_categories FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid())) WITH CHECK (public.is_coach_or_admin(auth.uid()));
CREATE POLICY "marks_select" ON public.marks FOR SELECT TO authenticated USING (true);
CREATE POLICY "marks_write" ON public.marks FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid())) WITH CHECK (public.is_coach_or_admin(auth.uid()));

-- simulacros
CREATE POLICY "st_select" ON public.simulacro_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "st_write" ON public.simulacro_templates FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid())) WITH CHECK (public.is_coach_or_admin(auth.uid()));
CREATE POLICY "stm_select" ON public.simulacro_template_marks FOR SELECT TO authenticated USING (true);
CREATE POLICY "stm_write" ON public.simulacro_template_marks FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid())) WITH CHECK (public.is_coach_or_admin(auth.uid()));

CREATE POLICY "se_select" ON public.simulacro_executions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_superadmin(auth.uid()) OR (public.is_coach_or_admin(auth.uid()) AND public.coach_has_user(auth.uid(), user_id)));
CREATE POLICY "se_write" ON public.simulacro_executions FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid()) OR auth.uid() = user_id)
  WITH CHECK (public.is_coach_or_admin(auth.uid()) OR auth.uid() = user_id);

CREATE POLICY "sr_select" ON public.simulacro_results FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.simulacro_executions e WHERE e.id = execution_id AND
    (e.user_id = auth.uid() OR public.is_superadmin(auth.uid()) OR (public.is_coach_or_admin(auth.uid()) AND public.coach_has_user(auth.uid(), e.user_id)))));
CREATE POLICY "sr_write" ON public.simulacro_results FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.simulacro_executions e WHERE e.id = execution_id AND
    (e.user_id = auth.uid() OR public.is_coach_or_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.simulacro_executions e WHERE e.id = execution_id AND
    (e.user_id = auth.uid() OR public.is_coach_or_admin(auth.uid()))));

-- mark_records
CREATE POLICY "mr_select" ON public.mark_records FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_superadmin(auth.uid()) OR (public.is_coach_or_admin(auth.uid()) AND public.coach_has_user(auth.uid(), user_id)));
CREATE POLICY "mr_write" ON public.mark_records FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid()) OR auth.uid() = user_id)
  WITH CHECK (public.is_coach_or_admin(auth.uid()) OR auth.uid() = user_id);

-- exercises
CREATE POLICY "ec_select" ON public.exercise_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "ec_write" ON public.exercise_categories FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid())) WITH CHECK (public.is_coach_or_admin(auth.uid()));
CREATE POLICY "ex_select" ON public.exercises FOR SELECT TO authenticated USING (true);
CREATE POLICY "ex_write" ON public.exercises FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid())) WITH CHECK (public.is_coach_or_admin(auth.uid()));

-- routines
CREATE POLICY "rt_select" ON public.routines FOR SELECT TO authenticated USING (true);
CREATE POLICY "rt_write" ON public.routines FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid())) WITH CHECK (public.is_coach_or_admin(auth.uid()));
CREATE POLICY "rd_select" ON public.routine_days FOR SELECT TO authenticated USING (true);
CREATE POLICY "rd_write" ON public.routine_days FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid())) WITH CHECK (public.is_coach_or_admin(auth.uid()));
CREATE POLICY "re_select" ON public.routine_exercises FOR SELECT TO authenticated USING (true);
CREATE POLICY "re_write" ON public.routine_exercises FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid())) WITH CHECK (public.is_coach_or_admin(auth.uid()));
CREATE POLICY "ra_select" ON public.routine_assignments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_superadmin(auth.uid()) OR (public.is_coach_or_admin(auth.uid()) AND public.coach_has_user(auth.uid(), user_id)));
CREATE POLICY "ra_write" ON public.routine_assignments FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid())) WITH CHECK (public.is_coach_or_admin(auth.uid()));

-- diary
CREATE POLICY "stp_select" ON public.session_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "stp_write" ON public.session_types FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid())) WITH CHECK (public.is_coach_or_admin(auth.uid()));
CREATE POLICY "dfc_select" ON public.diary_field_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY "dfc_write" ON public.diary_field_configs FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid())) WITH CHECK (public.is_coach_or_admin(auth.uid()));

CREATE POLICY "de_select" ON public.diary_entries FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_superadmin(auth.uid()) OR (public.is_coach_or_admin(auth.uid()) AND public.coach_has_user(auth.uid(), user_id)));
CREATE POLICY "de_write_own" ON public.diary_entries FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_coach_or_admin(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_coach_or_admin(auth.uid()));

CREATE POLICY "dev_select" ON public.diary_entry_values FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diary_entries d WHERE d.id = entry_id AND
    (d.user_id = auth.uid() OR public.is_superadmin(auth.uid()) OR (public.is_coach_or_admin(auth.uid()) AND public.coach_has_user(auth.uid(), d.user_id)))));
CREATE POLICY "dev_write" ON public.diary_entry_values FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diary_entries d WHERE d.id = entry_id AND
    (d.user_id = auth.uid() OR public.is_coach_or_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.diary_entries d WHERE d.id = entry_id AND
    (d.user_id = auth.uid() OR public.is_coach_or_admin(auth.uid()))));

-- personalized trainings
CREATE POLICY "pt_select" ON public.personalized_trainings FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_superadmin(auth.uid()) OR (public.is_coach_or_admin(auth.uid()) AND public.coach_has_user(auth.uid(), user_id)));
CREATE POLICY "pt_write" ON public.personalized_trainings FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid())) WITH CHECK (public.is_coach_or_admin(auth.uid()));

CREATE POLICY "ptv_select" ON public.personalized_training_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.personalized_trainings t WHERE t.id = training_id AND
    (t.user_id = auth.uid() OR public.is_superadmin(auth.uid()) OR (public.is_coach_or_admin(auth.uid()) AND public.coach_has_user(auth.uid(), t.user_id)))));
CREATE POLICY "ptv_write" ON public.personalized_training_versions FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid())) WITH CHECK (public.is_coach_or_admin(auth.uid()));

-- foro
CREATE POLICY "ft_select" ON public.forum_threads FOR SELECT TO authenticated USING (true);
CREATE POLICY "ft_insert" ON public.forum_threads FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "ft_update_own" ON public.forum_threads FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_coach_or_admin(auth.uid()));
CREATE POLICY "ft_delete_admin" ON public.forum_threads FOR DELETE TO authenticated
  USING (public.is_coach_or_admin(auth.uid()));

CREATE POLICY "fm_select" ON public.forum_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "fm_insert" ON public.forum_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fm_update_own" ON public.forum_messages FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_coach_or_admin(auth.uid()));
CREATE POLICY "fm_delete_admin" ON public.forum_messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_coach_or_admin(auth.uid()));

-- chat privado
CREATE POLICY "pc_select" ON public.private_conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = coach_id OR public.is_superadmin(auth.uid()));
CREATE POLICY "pc_insert" ON public.private_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR auth.uid() = coach_id);
CREATE POLICY "pc_update" ON public.private_conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = coach_id);

CREATE POLICY "pm_select" ON public.private_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.private_conversations c WHERE c.id = conversation_id AND
    (c.user_id = auth.uid() OR c.coach_id = auth.uid() OR public.is_superadmin(auth.uid()))));
CREATE POLICY "pm_insert" ON public.private_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.private_conversations c WHERE c.id = conversation_id AND
    (c.user_id = auth.uid() OR c.coach_id = auth.uid())));
CREATE POLICY "pm_update" ON public.private_messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.private_conversations c WHERE c.id = conversation_id AND
    (c.user_id = auth.uid() OR c.coach_id = auth.uid())));

-- bulk imports (solo el coach dueño y superadmin)
CREATE POLICY "bi_select" ON public.bulk_imports FOR SELECT TO authenticated
  USING (auth.uid() = coach_id OR public.is_superadmin(auth.uid()));
CREATE POLICY "bi_write" ON public.bulk_imports FOR ALL TO authenticated
  USING (auth.uid() = coach_id OR public.is_superadmin(auth.uid()))
  WITH CHECK (auth.uid() = coach_id OR public.is_superadmin(auth.uid()));

-- =====================================================
-- STORAGE BUCKETS
-- =====================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "attachments_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'attachments');
CREATE POLICY "attachments_coach_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND public.is_coach_or_admin(auth.uid()));
CREATE POLICY "attachments_coach_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'attachments' AND public.is_coach_or_admin(auth.uid()));
CREATE POLICY "attachments_coach_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND public.is_coach_or_admin(auth.uid()));

-- =====================================================
-- SEED DATA
-- =====================================================
INSERT INTO public.oposiciones (nombre, descripcion) VALUES
  ('Policía Nacional', 'Pruebas físicas para acceso a Policía Nacional'),
  ('Guardia Civil', 'Pruebas físicas para acceso a Guardia Civil'),
  ('Bomberos', 'Pruebas físicas para acceso a Bomberos'),
  ('Policía Local', 'Pruebas físicas para acceso a Policía Local');

INSERT INTO public.mark_categories (nombre, orden) VALUES
  ('Carrera', 1), ('Salto', 2), ('Fuerza', 3), ('Resistencia', 4), ('Agilidad', 5);

INSERT INTO public.marks (category_id, nombre, value_type, unidad, mejor_mayor, orden)
SELECT id, '100 metros', 'tiempo', 'segundos', false, 1 FROM public.mark_categories WHERE nombre='Carrera';
INSERT INTO public.marks (category_id, nombre, value_type, unidad, mejor_mayor, orden)
SELECT id, '1000 metros', 'tiempo', 'segundos', false, 2 FROM public.mark_categories WHERE nombre='Carrera';
INSERT INTO public.marks (category_id, nombre, value_type, unidad, mejor_mayor, orden)
SELECT id, 'Salto de longitud', 'distancia', 'metros', true, 1 FROM public.mark_categories WHERE nombre='Salto';
INSERT INTO public.marks (category_id, nombre, value_type, unidad, mejor_mayor, orden)
SELECT id, 'Dominadas', 'repeticiones', 'reps', true, 1 FROM public.mark_categories WHERE nombre='Fuerza';
INSERT INTO public.marks (category_id, nombre, value_type, unidad, mejor_mayor, orden)
SELECT id, 'Press militar', 'peso', 'kg', true, 2 FROM public.mark_categories WHERE nombre='Fuerza';
INSERT INTO public.marks (category_id, nombre, value_type, unidad, mejor_mayor, orden)
SELECT id, 'Suspensión en barra', 'tiempo', 'segundos', true, 3 FROM public.mark_categories WHERE nombre='Fuerza';
INSERT INTO public.marks (category_id, nombre, value_type, unidad, mejor_mayor, orden)
SELECT id, 'Circuito de agilidad', 'tiempo', 'segundos', false, 1 FROM public.mark_categories WHERE nombre='Agilidad';

INSERT INTO public.exercise_categories (nombre, orden) VALUES
  ('Pecho', 1), ('Espalda', 2), ('Hombro', 3), ('Cuádriceps', 4),
  ('Glúteo', 5), ('Abdominales', 6), ('Cardio', 7), ('Movilidad', 8);

INSERT INTO public.session_types (nombre, orden) VALUES
  ('Entrenamiento de fuerza', 1), ('Carrera continua', 2), ('Series', 3),
  ('Circuito', 4), ('Movilidad', 5), ('Simulacro', 6);

INSERT INTO public.diary_field_configs (nombre, label, field_type, config, orden) VALUES
  ('sueno', 'Calidad del sueño', 'slider', '{"min":1,"max":10}'::jsonb, 1),
  ('estres', 'Estrés / fatiga previa', 'slider', '{"min":1,"max":10}'::jsonb, 2),
  ('rpe', 'Esfuerzo percibido (RPE)', 'slider', '{"min":1,"max":10}'::jsonb, 3),
  ('nota_sesion', 'Nota de la sesión', 'slider', '{"min":1,"max":10}'::jsonb, 4);
