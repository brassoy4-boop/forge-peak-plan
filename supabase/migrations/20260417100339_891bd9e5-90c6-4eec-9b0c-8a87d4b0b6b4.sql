-- 1. Añadir avatar_url a profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Crear tabla notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  contenido text,
  link text,
  leida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, leida, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_superadmin(auth.uid()));

CREATE POLICY "notif_insert_any" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "notif_delete_admin" ON public.notifications
  FOR DELETE TO authenticated
  USING (public.is_superadmin(auth.uid()));

-- 3. Realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;