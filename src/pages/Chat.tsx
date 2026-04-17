import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";

export default function Chat() {
  const { user, primaryRole } = useAuth();
  const isCoach = primaryRole === "entrenador" || primaryRole === "superadmin";
  const [convs, setConvs] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [newContact, setNewContact] = useState("");

  const loadConvs = async () => {
    if (!user) return;
    const { data } = await supabase.from("private_conversations").select("*, user_profile:profiles!private_conversations_user_id_fkey(nombre, apellidos), coach_profile:profiles!private_conversations_coach_id_fkey(nombre, apellidos)").or(`user_id.eq.${user.id},coach_id.eq.${user.id}`).order("last_message_at", { ascending: false });
    setConvs(data ?? []);
  };
  const loadContacts = async () => {
    if (!user) return;
    if (isCoach) {
      const { data } = await supabase.from("coach_assignments").select("user_id, profiles!coach_assignments_user_id_fkey(user_id, nombre, apellidos)").eq("coach_id", user.id);
      setContacts((data ?? []).map((d: any) => d.profiles).filter(Boolean));
    } else {
      const { data } = await supabase.from("coach_assignments").select("coach_id, profiles!coach_assignments_coach_id_fkey(user_id, nombre, apellidos)").eq("user_id", user.id);
      setContacts((data ?? []).map((d: any) => d.profiles).filter(Boolean));
    }
  };
  useEffect(() => { loadConvs(); loadContacts(); }, [user]);

  useEffect(() => {
    if (!selected) return;
    supabase.from("private_messages").select("*").eq("conversation_id", selected.id).order("created_at")
      .then(({ data }) => setMessages(data ?? []));
  }, [selected]);

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
    const { error } = await supabase.from("private_messages").insert({ conversation_id: selected.id, sender_id: user.id, contenido: text });
    if (error) return toast.error(error.message);
    await supabase.from("private_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", selected.id);
    setText("");
    const { data } = await supabase.from("private_messages").select("*").eq("conversation_id", selected.id).order("created_at");
    setMessages(data ?? []);
  };

  return (
    <div>
      <PageHeader title="Chat privado" description="Conversaciones directas." />
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
              const other = isCoach ? c.user_profile : c.coach_profile;
              return (
                <button key={c.id} onClick={() => setSelected(c)} className={`w-full text-left p-2 rounded text-sm ${selected?.id === c.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  {other?.nombre} {other?.apellidos}
                </button>
              );
            })}
            {convs.length === 0 && <p className="text-xs text-muted-foreground">Sin conversaciones.</p>}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> {selected ? "Conversación" : "Selecciona una conversación"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="h-72 overflow-y-auto space-y-2 border rounded p-2 bg-muted/30">
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
