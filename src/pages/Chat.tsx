import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ProfileLite {
  user_id: string;
  nombre: string;
  apellidos: string;
  acepta_mensajes_usuarios?: boolean;
}

export default function Chat() {
  const { user, primaryRole } = useAuth();
  const isCoach = primaryRole === "entrenador" || primaryRole === "superadmin";
  const [convs, setConvs] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfileLite>>({});
  const [selected, setSelected] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [contacts, setContacts] = useState<ProfileLite[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [rolesByUser, setRolesByUser] = useState<Record<string, string[]>>({});
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
      const m: Record<string, ProfileLite> = { ...profilesMap };
      (profs ?? []).forEach((p: any) => { m[p.user_id] = { ...m[p.user_id], ...p }; });
      setProfilesMap(m);
    }
  };

  // Carga de contactos disponibles según rol
  const loadContacts = async () => {
    if (!user) return;
    const { data: allRoles } = await supabase.from("user_roles").select("user_id, role");
    const rolesMap: Record<string, string[]> = {};
    (allRoles ?? []).forEach((r: any) => {
      rolesMap[r.user_id] = [...(rolesMap[r.user_id] ?? []), r.role];
    });
    setRolesByUser(rolesMap);

    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, nombre, apellidos, acepta_mensajes_usuarios")
      .neq("user_id", user.id)
      .order("nombre");
    const all = (profs ?? []) as ProfileLite[];

    let visible: ProfileLite[] = [];
    if (primaryRole === "superadmin") {
      visible = all;
    } else if (primaryRole === "entrenador") {
      // Sus deportistas + otros entrenadores + superadmin
      const { data: ca } = await supabase.from("coach_assignments").select("user_id").eq("coach_id", user.id);
      const myUsers = new Set((ca ?? []).map((x: any) => x.user_id));
      visible = all.filter((p) => {
        const roles = rolesMap[p.user_id] ?? [];
        if (roles.includes("superadmin") || roles.includes("entrenador")) return true;
        return myUsers.has(p.user_id);
      });
    } else {
      // Usuario: sus entrenadores + superadmin + otros usuarios que aceptan mensajes
      const { data: ca } = await supabase.from("coach_assignments").select("coach_id").eq("user_id", user.id);
      const myCoaches = new Set((ca ?? []).map((x: any) => x.coach_id));
      visible = all.filter((p) => {
        const roles = rolesMap[p.user_id] ?? [];
        if (roles.includes("superadmin")) return true;
        if (roles.includes("entrenador") && myCoaches.has(p.user_id)) return true;
        // Otro usuario: solo si acepta
        if (!roles.includes("entrenador") && !roles.includes("superadmin")) {
          return p.acepta_mensajes_usuarios !== false;
        }
        return false;
      });
    }
    setContacts(visible);
    const m: Record<string, ProfileLite> = { ...profilesMap };
    visible.forEach((p) => { m[p.user_id] = { ...m[p.user_id], ...p }; });
    setProfilesMap(m);
  };

  useEffect(() => { loadConvs(); loadContacts(); /* eslint-disable-next-line */ }, [user, primaryRole]);

  useEffect(() => {
    if (!selected) return;
    supabase.from("private_messages").select("*").eq("conversation_id", selected.id).order("created_at")
      .then(({ data }) => setMessages(data ?? []));

    const channel = supabase
      .channel(`pm-${selected.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "private_messages", filter: `conversation_id=eq.${selected.id}` },
        (payload) => setMessages((prev) => prev.some((m) => m.id === (payload.new as any).id) ? prev : [...prev, payload.new as any]),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const startConvWith = async (otherId: string) => {
    if (!user) return;
    const other = contacts.find((c) => c.user_id === otherId);
    if (!other) return;
    const otherRoles = rolesByUser[otherId] ?? [];
    const otherIsCoachOrSuper = otherRoles.includes("entrenador") || otherRoles.includes("superadmin");

    // Validación: si yo soy usuario y el otro también, debe aceptar mensajes
    if (!isCoach && !otherIsCoachOrSuper && other.acepta_mensajes_usuarios === false) {
      return toast.error("Este usuario no acepta mensajes de otros usuarios");
    }

    // Modelo de conversación: campo coach_id reservado al "lado coach" cuando aplique.
    // Si ninguno es coach, lo guardamos en (user_id=yo, coach_id=otro) para mantener unicidad.
    const myIsCoach = isCoach;
    const userId = myIsCoach ? otherId : user.id;
    const coachId = myIsCoach ? user.id : otherId;

    const { data: existing } = await supabase
      .from("private_conversations")
      .select("*")
      .eq("user_id", userId)
      .eq("coach_id", coachId)
      .maybeSingle();
    if (existing) { setSelected(existing); return; }

    const { data, error } = await supabase
      .from("private_conversations")
      .insert({ user_id: userId, coach_id: coachId })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setSelected(data);
    loadConvs();
  };

  const send = async () => {
    if (!user || !selected || !text.trim()) return;
    const content = text;
    setText("");
    const { error } = await supabase.from("private_messages").insert({ conversation_id: selected.id, sender_id: user.id, contenido: content });
    if (error) { toast.error(error.message); setText(content); return; }
    await supabase.from("private_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", selected.id);
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

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts;
    const q = contactSearch.toLowerCase();
    return contacts.filter((c) => `${c.nombre} ${c.apellidos}`.toLowerCase().includes(q));
  }, [contacts, contactSearch]);

  const otherIdOf = (c: any) => (c.user_id === user?.id ? c.coach_id : c.user_id);

  return (
    <div>
      <PageHeader title="Chat privado" description="Conversaciones directas en tiempo real." />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardHeader><CardTitle className="text-base">Conversaciones</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Buscar persona..." value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} />
              </div>
              {contactSearch.trim() && (
                <div className="border rounded max-h-48 overflow-y-auto">
                  {filteredContacts.length === 0 && <p className="text-xs text-muted-foreground p-2">Sin resultados.</p>}
                  {filteredContacts.map((c) => {
                    const cRoles = rolesByUser[c.user_id] ?? [];
                    const tag = cRoles.includes("superadmin") ? "Admin" : cRoles.includes("entrenador") ? "Entrenador" : "Usuario";
                    return (
                      <button key={c.user_id} onClick={() => { startConvWith(c.user_id); setContactSearch(""); }} className="w-full text-left p-2 text-sm hover:bg-muted flex justify-between items-center">
                        <span>{c.nombre} {c.apellidos}</span>
                        <span className="text-[10px] text-muted-foreground">{tag}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="space-y-1">
              {convs.map(c => {
                const oid = otherIdOf(c);
                const other = profilesMap[oid];
                return (
                  <button key={c.id} onClick={() => setSelected(c)} className={`w-full text-left p-2 rounded text-sm ${selected?.id === c.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                    {other ? `${other.nombre} ${other.apellidos}` : "—"}
                  </button>
                );
              })}
              {convs.length === 0 && <p className="text-xs text-muted-foreground">Sin conversaciones. Busca una persona arriba para iniciar.</p>}
            </div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> {selected ? (profilesMap[otherIdOf(selected)] ? `${profilesMap[otherIdOf(selected)].nombre} ${profilesMap[otherIdOf(selected)].apellidos}` : "Conversación") : "Selecciona una conversación"}</CardTitle></CardHeader>
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
