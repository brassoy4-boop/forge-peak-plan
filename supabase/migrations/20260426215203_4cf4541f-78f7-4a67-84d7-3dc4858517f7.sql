
-- Attach trigger so new auth users automatically get profile + 'usuario' role
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill missing profiles for existing auth users
INSERT INTO public.profiles (user_id, nombre, apellidos, email)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'nombre', ''),
       COALESCE(u.raw_user_meta_data->>'apellidos', ''),
       u.email
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL;

-- Backfill missing default 'usuario' role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'usuario'::app_role
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id);
