import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface Notification {
  id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  contenido: string | null;
  link: string | null;
  leida: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data ?? []) as Notification[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, load]);

  const markRead = async (id: string) => {
    // Optimista: marcar localmente sin esperar al realtime
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)));
    const { error } = await supabase.from("notifications").update({ leida: true }).eq("id", id);
    if (error) {
      // Rollback si falla
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, leida: false } : n)));
    }
  };

  const markAllRead = async () => {
    if (!user) return;
    // Optimista
    setItems((prev) => prev.map((n) => ({ ...n, leida: true })));
    const { error } = await supabase
      .from("notifications")
      .update({ leida: true })
      .eq("user_id", user.id)
      .eq("leida", false);
    if (error) {
      // Recargar estado real si fallo
      load();
    }
  };

  const unread = items.filter((n) => !n.leida).length;

  return { items, unread, loading, markRead, markAllRead, reload: load };
}

/** Crea una notificación para otro usuario. */
export async function createNotification(
  userId: string,
  tipo: string,
  titulo: string,
  contenido?: string,
  link?: string
) {
  await supabase.from("notifications").insert({
    user_id: userId,
    tipo,
    titulo,
    contenido: contenido ?? null,
    link: link ?? null,
  });
}
