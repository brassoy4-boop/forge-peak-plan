
-- Tabla de baremos por marca, oposición y sexo
CREATE TABLE public.mark_baremos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mark_id UUID NOT NULL,
  oposicion_id UUID,
  sexo public.sexo_enum NOT NULL DEFAULT 'unisex',
  nivel TEXT NOT NULL,
  valor_min NUMERIC,
  valor_max NUMERIC,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mark_baremos_lookup ON public.mark_baremos (mark_id, oposicion_id, sexo);

ALTER TABLE public.mark_baremos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "baremos_select_all" ON public.mark_baremos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "baremos_write_coach" ON public.mark_baremos
  FOR ALL TO authenticated
  USING (public.is_coach_or_admin(auth.uid()))
  WITH CHECK (public.is_coach_or_admin(auth.uid()));

CREATE TRIGGER trg_mark_baremos_updated
  BEFORE UPDATE ON public.mark_baremos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
