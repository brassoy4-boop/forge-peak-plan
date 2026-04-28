
CREATE TABLE public.cooper_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  temperatura numeric NULL,
  condiciones text NULL,
  notas text NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cooper_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY ct_select ON public.cooper_tests FOR SELECT TO authenticated USING (true);
CREATE POLICY ct_write ON public.cooper_tests FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid()))
  WITH CHECK (public.is_coach_or_admin(auth.uid()));

CREATE TRIGGER trg_cooper_tests_updated
  BEFORE UPDATE ON public.cooper_tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cooper_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.cooper_tests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  sexo public.sexo_enum NOT NULL DEFAULT 'unisex',
  fecha_nacimiento date NULL,
  cuerpo text NULL,
  peso numeric NULL,
  distancia_m integer NOT NULL,
  fc_final integer NULL,
  fc_60s integer NULL,
  tiempo_bajo_100_seg integer NULL,
  observaciones text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_id, user_id)
);

ALTER TABLE public.cooper_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY cr_select ON public.cooper_results FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_superadmin(auth.uid())
    OR (public.is_coach_or_admin(auth.uid()) AND public.coach_has_user(auth.uid(), user_id))
  );

CREATE POLICY cr_write ON public.cooper_results FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid()))
  WITH CHECK (public.is_coach_or_admin(auth.uid()));

CREATE TRIGGER trg_cooper_results_updated
  BEFORE UPDATE ON public.cooper_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cooper_results_test ON public.cooper_results(test_id);
CREATE INDEX idx_cooper_results_user ON public.cooper_results(user_id);
