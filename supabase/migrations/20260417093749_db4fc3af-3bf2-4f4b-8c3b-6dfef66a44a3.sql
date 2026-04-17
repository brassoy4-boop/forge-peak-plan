ALTER TABLE public.private_messages REPLICA IDENTITY FULL;
ALTER TABLE public.forum_messages REPLICA IDENTITY FULL;
ALTER TABLE public.forum_threads REPLICA IDENTITY FULL;
ALTER TABLE public.private_conversations REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.private_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_threads;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.private_conversations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;