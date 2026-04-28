CREATE OR REPLACE FUNCTION public.get_feature_flags()
RETURNS TABLE(key text, value text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT key, value FROM public.app_settings WHERE key LIKE 'feature_%';
$$;