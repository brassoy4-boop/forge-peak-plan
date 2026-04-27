-- 1. parent_id en forum_messages
ALTER TABLE public.forum_messages
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.forum_messages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_forum_messages_parent_id ON public.forum_messages(parent_id);

-- 2. Preferencia de mensajes en profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS acepta_mensajes_usuarios boolean NOT NULL DEFAULT true;

-- 3. Realtime para notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;