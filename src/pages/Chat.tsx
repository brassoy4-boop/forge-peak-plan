import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface ProfileLite { user_id: string; nombre: string; apellidos: string; }

export default function Chat() {
  const { user, primaryRole } = useAuth();
  const isCoach = primaryRole === "entrenador" || primaryRole === "superadmin";
  const [convs, setConvs] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfileLite>>({});
  const [selected, setSelected] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [contacts, setContacts] = useState<ProfileLite[]>([]);
  const [newContact, setNewContact] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConvs = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("private_conversations")
      .select("*")
      .or(`user_id.eq.${user.id},coach_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false });
    const list = data ?? [];
    setConvs(list);
    const ids = Array.from(new Set(list.flatMap((c: any) => [c.user_id, c.coach_id])));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, nombre, apellidos").in("user_id", ids);
      const m: Record<string, ProfileLite> = {};
      (profs ?? []).forEach((p: any) => { m[p.user_id] = p; });
      setProfilesMap(m);
    }
  };

  const loadContacts = async () => {
    if (!user) return;
    const col = isCoach ? "user_id" : "coach_id";
    const filter = isCoach ? { coach_id: user.id } : { user_id: user.id };
    const { data: ca } = await supabase.from("coach_assignments").select(col).match(filter);
    const ids = (ca ?? []).map((x: any) => x[col]);
    if (!ids.length) { setContacts([]); return; }
    const { data: profs } = await supabase.from("profiles").select("user_id, nombre, apellidos").in("user_id", ids);
    setContacts(profs ?? []);
  };

  useEffect(() => { loadConvs(); loadContacts(); }, [user]);

  useEffect(() => {
    if (!selected) return;
    supabase.from("private_messages").select("*").eq("conversation_id", selected.id).order("created_at")
      .then(({ data }) => setMessages(data ?? []));

    // Realtime suscripción
    const channel = supabase
      .channel(`pm-${selected.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "private_messages", filter: `conversation_id=eq.${selected.id}` },
        (payload) => setMessages((prev) => [...prev, payload.new as any]),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const startConv = async () => {
    if (!user || !newContact) return;
    const userId = isCoach ? newContact : user.id;
    const coachId = isCoach ? user.id : newContact;
    const { data: existing } = await supabase.from("private_conversations").select("*").eq("user_id", userId).eq("coach_id", coachId).maybeSingle();
    if (existing) { setSelected(existing); return; }
    const { data, error } = await supabase.from("private_conversations").insert({ user_id: userId, coach_id: coachId }).select().single();
    if (error) return toast.error(error.message);
    setSelected(data); loadConvs();
  };

  const send = async () => {
    if (!user || !selected || !text.trim()) return;
    const content = text;
    setText("");
    const { error } = await supabase.from("private_messages").insert({ conversation_id: selected.id, sender_id: user.id, contenido: content });
    if (error) { toast.error(error.message); setText(content); return; }
    await supabase.from("private_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", selected.id);
    // Notificar al otro participante
    const otherId = selected.user_id === user.id ? selected.coach_id : selected.user_id;
    if (otherId) {
      await supabase.from("notifications").insert({
        user_id: otherId, tipo: "chat",
        titulo: "Nuevo mensaje privado",
        contenido: content.slice(0, 80),
        link: "/app/chat",
      });
    }
  };

  return (
    <div>
      <PageHeader title="Chat privado" description="Conversaciones directas en tiempo real." />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Conversaciones</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Select value={newContact} onValueChange={setNewContact}>
                <SelectTrigger><SelectValue placeholder="Nuevo..." /></SelectTrigger>
                <SelectContent>{contacts.map(c => <SelectItem key={c.user_id} value={c.user_id}>{c.nombre} {c.apellidos}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" onClick={startConv} disabled={!newContact}>+</Button>
            </div>
            {convs.map(c => {
              const otherId = isCoach ? c.user_id : c.coach_id;
              const other = profilesMap[otherId];
              return (
                <button key={c.id} onClick={() => setSelected(c)} className={`w-full text-left p-2 rounded text-sm ${selected?.id === c.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  {other ? `${other.nombre} ${other.apellidos}` : "—"}
                </button>
              );
            })}
            {convs.length === 0 && <p className="text-xs text-muted-foreground">Sin conversaciones.</p>}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> {selected ? "Conversación" : "Selecciona una conversación"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div ref={scrollRef} className="h-72 overflow-y-auto space-y-2 border rounded p-2 bg-muted/30">
              {messages.map(m => (
                <div key={m.id} className={`max-w-[80%] p-2 rounded text-sm ${m.sender_id === user?.id ? "ml-auto bg-primary text-primary-foreground" : "bg-card border"}`}>
                  {m.contenido}
                  <div className="text-[10px] opacity-70 mt-1">{new Date(m.created_at).toLocaleTimeString("es-ES")}</div>
                </div>
              ))}
              {messages.length === 0 && selected && <p className="text-xs text-muted-foreground text-center">Sin mensajes.</p>}
            </div>
            {selected && (
              <div className="flex gap-2">
                <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Escribe un mensaje..." />
                <Button onClick={send}>Enviar</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
