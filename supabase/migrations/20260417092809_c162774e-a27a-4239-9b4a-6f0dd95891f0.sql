-- Seed: oposiciones
INSERT INTO public.oposiciones (nombre, descripcion, status)
SELECT * FROM (VALUES
  ('Policía Nacional', 'Pruebas físicas para acceso a Policía Nacional', 'activo'::entity_status),
  ('Guardia Civil', 'Pruebas físicas para acceso a Guardia Civil', 'activo'::entity_status),
  ('Bomberos', 'Pruebas físicas para acceso a Bomberos', 'activo'::entity_status),
  ('Policía Local', 'Pruebas físicas para acceso a Policía Local', 'activo'::entity_status)
) AS v(nombre, descripcion, status)
WHERE NOT EXISTS (SELECT 1 FROM public.oposiciones WHERE oposiciones.nombre = v.nombre);

-- Seed: mark_categories
INSERT INTO public.mark_categories (nombre, orden)
SELECT * FROM (VALUES
  ('Velocidad', 1), ('Resistencia', 2), ('Fuerza', 3), ('Salto', 4), ('Agilidad', 5)
) AS v(nombre, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.mark_categories WHERE mark_categories.nombre = v.nombre);

-- Seed: marks
INSERT INTO public.marks (nombre, value_type, unidad, mejor_mayor, category_id, orden)
SELECT v.nombre, v.value_type::mark_value_type, v.unidad, v.mejor_mayor,
       (SELECT id FROM public.mark_categories WHERE nombre = v.cat),
       v.orden
FROM (VALUES
  ('100 metros lisos', 'tiempo', 'segundos', false, 'Velocidad', 1),
  ('1000 metros', 'tiempo', 'segundos', false, 'Resistencia', 1),
  ('2000 metros', 'tiempo', 'segundos', false, 'Resistencia', 2),
  ('Salto de longitud', 'distancia', 'metros', true, 'Salto', 1),
  ('Dominadas', 'repeticiones', 'reps', true, 'Fuerza', 1),
  ('Suspensión en barra', 'tiempo', 'segundos', true, 'Fuerza', 2),
  ('Circuito de agilidad', 'tiempo', 'segundos', false, 'Agilidad', 1),
  ('Press militar', 'peso', 'kg', true, 'Fuerza', 3)
) AS v(nombre, value_type, unidad, mejor_mayor, cat, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.marks WHERE marks.nombre = v.nombre);

-- Seed: exercise_categories
INSERT INTO public.exercise_categories (nombre, orden)
SELECT * FROM (VALUES
  ('Pecho', 1), ('Espalda', 2), ('Hombro', 3), ('Pierna', 4),
  ('Core', 5), ('Cardio', 6), ('Movilidad', 7)
) AS v(nombre, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.exercise_categories WHERE exercise_categories.nombre = v.nombre);

-- Seed: session_types
INSERT INTO public.session_types (nombre, orden)
SELECT * FROM (VALUES
  ('Fuerza', 1), ('Carrera', 2), ('Técnica', 3), ('Descanso activo', 4), ('Simulacro', 5)
) AS v(nombre, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.session_types WHERE session_types.nombre = v.nombre);

-- Seed: diary_field_configs
INSERT INTO public.diary_field_configs (nombre, label, field_type, config, orden)
SELECT v.nombre, v.label, v.field_type, v.config::jsonb, v.orden
FROM (VALUES
  ('sueno', 'Calidad del sueño', 'slider', '{"min":1,"max":10,"step":1}', 1),
  ('estres', 'Nivel de estrés', 'slider', '{"min":1,"max":10,"step":1}', 2),
  ('rpe', 'RPE (esfuerzo percibido)', 'slider', '{"min":1,"max":10,"step":1}', 3)
) AS v(nombre, label, field_type, config, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.diary_field_configs WHERE diary_field_configs.nombre = v.nombre);

-- Seed: PIN global por defecto
INSERT INTO public.app_settings (key, value)
VALUES ('access_pin', '942')
ON CONFLICT (key) DO NOTHING;

-- Función: comprobar si existe superadmin
CREATE OR REPLACE FUNCTION public.superadmin_exists()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'superadmin');
$$;

-- Función: promocionar al usuario actual a superadmin si no hay ninguno
CREATE OR REPLACE FUNCTION public.promote_to_superadmin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'superadmin') THEN
    RETURN false;
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'superadmin')
  ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

-- Función: actualizar PIN global (solo superadmin)
CREATE OR REPLACE FUNCTION public.set_access_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo el superadmin puede cambiar el PIN';
  END IF;
  IF _pin IS NULL OR length(_pin) < 3 THEN
    RAISE EXCEPTION 'PIN inválido';
  END IF;
  UPDATE public.app_settings SET value = _pin, updated_at = now() WHERE key = 'access_pin';
  IF NOT FOUND THEN
    INSERT INTO public.app_settings (key, value) VALUES ('access_pin', _pin);
  END IF;
  RETURN true;
END;
$$;