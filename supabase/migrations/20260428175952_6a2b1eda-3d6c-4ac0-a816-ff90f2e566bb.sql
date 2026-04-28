CREATE TYPE public.cooper_fase AS ENUM ('inicial','mesociclo_1','mesociclo_2','pre_examen');
ALTER TABLE public.cooper_tests ADD COLUMN fase public.cooper_fase NOT NULL DEFAULT 'inicial';