import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MessageSquare, Plus, Trash2, Reply, X } from "lucide-react";
import { toast } from "sonner";

interface ProfileLite { user_id: string; nombre: string; apellidos: string; }

export default function Foro() {
  const { user, roles } = useAuth();
  const isSuperadmin = roles.includes("superadmin");
  const [threads, setThreads] = useState<any[]>([]);
  const [oposiciones, setOposiciones] = useState<any[]>([]);
  const [filterOpo, setFilterOpo] = useState<string>("__all__");
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfileLite>>({});
  const [selected, setSelected] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ titulo: "", contenido: "", oposicion_id: "__none__" });
  const [reply, setReply] = useState("");
  const [replyTo, setReplyTo] = useState<any | null>(null); // mensaje al que se responde

  const loadOpos = async () => {
    const { data } = await supabase.from("oposiciones").select("id, nombre").order("nombre");
    setOposiciones(data ?? []);
  };

  const loadThreads = async () => {
    let q = supabase.from("forum_threads").select("*, oposiciones(nombre)").order("updated_at", { ascending: false });
    if (filterOpo !== "__all__") {
      q = filterOpo === "__none__" ? q.is("oposicion_id", null) : q.eq("oposicion_id", filterOpo);
    }
    const { data } = await q;
    const list = data ?? [];
    setThreads(list);
    const ids = Array.from(new Set(list.map((t: any) => t.created_by)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, nombre, apellidos").in("user_id", ids);
      const m: Record<string, ProfileLite> = {};
      (profs ?? []).forEach((p: any) => { m[p.user_id] = p; });
      setProfilesMap((prev) => ({ ...prev, ...m }));
    }
  };

  const loadMessages = async (threadId: string) => {
    const { data } = await supabase.from("forum_messages").select("*").eq("thread_id", threadId).order("created_at");
    const list = data ?? [];
    setMessages(list);
    const ids = Array.from(new Set(list.map((m: any) => m.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, nombre, apellidos").in("user_id", ids);
      const m: Record<string, ProfileLite> = {};
      (profs ?? []).forEach((p: any) => { m[p.user_id] = p; });
      setProfilesMap((prev) => ({ ...prev, ...m }));
    }
  };

  useEffect(() => { loadOpos(); }, []);
  useEffect(() => { loadThreads(); }, [filterOpo]);

  useEffect(() => {
    if (!selected) return;
    loadMessages(selected.id);
    const ch = supabase
      .channel(`fm-${selected.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "forum_messages", filter: `thread_id=eq.${selected.id}` },
        () => loadMessages(selected.id),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selected]);

  const createThread = async () => {
    if (!user || !form.titulo) return;
    const payload: any = { titulo: form.titulo, created_by: user.id };
    if (form.oposicion_id !== "__none__") payload.oposicion_id = form.oposicion_id;
    const { data, error } = await supabase.from("forum_threads").insert(payload).select().single();
    if (error) return toast.error(error.message);
    if (form.contenido) await supabase.from("forum_messages").insert({ thread_id: data.id, user_id: user.id, contenido: form.contenido });
    toast.success("Hilo creado"); setOpen(false);
    setForm({ titulo: "", contenido: "", oposicion_id: "__none__" });
    loadThreads();
  };

  const sendReply = async () => {
    if (!user || !selected || !reply.trim()) return;
    const content = reply;
    const parentMsg = replyTo;
    setReply("");
    setReplyTo(null);
    const payload: any = { thread_id: selected.id, user_id: user.id, contenido: content };
    if (parentMsg?.id) payload.parent_id = parentMsg.id;
    const { data, error } = await supabase.from("forum_messages").insert(payload).select().single();
    if (error) { toast.error(error.message); setReply(content); setReplyTo(parentMsg); return; }
    if (data) setMessages((prev) => prev.some((m) => m.id === data.id) ? prev : [...prev, data]);
    await supabase.from("forum_threads").update({ updated_at: new Date().toISOString() }).eq("id", selected.id);

    // Notificar al destinatario apropiado
    const notifyIds: string[] = [];
    if (parentMsg && parentMsg.user_id !== user.id) {
      notifyIds.push(parentMsg.user_id);
    } else if (!parentMsg && selected.created_by && selected.created_by !== user.id) {
      notifyIds.push(selected.created_by);
    }
    if (notifyIds.length) {
      await supabase.from("notifications").insert(notifyIds.map((uid) => ({
        user_id: uid,
        tipo: "foro",
        titulo: parentMsg ? "Han respondido a tu mensaje" : "Nueva respuesta en tu hilo",
        contenido: `${selected.titulo}: ${content.slice(0, 80)}`,
        link: "/app/foro",
      })));
    }
    loadMessages(selected.id);
  };

  const deleteThread = async (id: string) => {
    await supabase.from("forum_messages").delete().eq("thread_id", id);
    const { error } = await supabase.from("forum_threads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Hilo eliminado");
    setSelected(null);
    loadThreads();
  };

  const deleteMessage = async (id: string) => {
    const { error } = await supabase.from("forum_messages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setMessages((prev) => prev.filter((m) => m.id !== id));
    toast.success("Mensaje eliminado");
  };

  const messagesById = Object.fromEntries(messages.map((m) => [m.id, m]));

  return (
    <div>
      <PageHeader title="Foro" description="Hilos generales de la comunidad."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Nuevo hilo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo hilo</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2"><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
                <div className="space-y-2"><Label>Oposición (opcional)</Label>
                  <Select value={form.oposicion_id} onValueChange={(v) => setForm({ ...form, oposicion_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">General (sin oposición)</SelectItem>
                      {oposiciones.map(o => <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Mensaje inicial</Label><Textarea value={form.contenido} onChange={(e) => setForm({ ...form, contenido: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={createThread}>Publicar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 max-w-xs">
        <Label className="text-xs">Filtrar por oposición</Label>
        <Select value={filterOpo} onValueChange={setFilterOpo}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="__none__">Solo generales</SelectItem>
            {oposiciones.map(o => <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {!selected ? (
        <div className="space-y-2">
          {threads.map(t => {
            const author = profilesMap[t.created_by];
            return (
              <Card key={t.id} className="hover:border-primary">
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer" onClick={() => setSelected(t)}>
                    <MessageSquare className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.titulo}</div>
                      <div className="text-xs text-muted-foreground">
                        {author ? `${author.nombre} ${author.apellidos}` : "—"}
                        {t.oposiciones?.nombre && <span> · {t.oposiciones.nombre}</span>}
                        <span> · {new Date(t.updated_at).toLocaleDateString("es-ES")}</span>
                      </div>
                    </div>
                  </div>
                  {isSuperadmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={(e) => e.stopPropagation()}><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar este hilo?</AlertDialogTitle>
                          <AlertDialogDescription>Se eliminarán también todos sus mensajes. Esta acción no se puede deshacer.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteThread(t.id)}>Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {threads.length === 0 && <p className="text-center text-muted-foreground py-8">Sin hilos todavía.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => { setSelected(null); setReplyTo(null); }}>← Volver</Button>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="brand-title text-2xl">{selected.titulo}</CardTitle>
              {isSuperadmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-2" /> Eliminar hilo</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar este hilo?</AlertDialogTitle>
                      <AlertDialogDescription>Se eliminarán también todos sus mensajes. Esta acción no se puede deshacer.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteThread(selected.id)}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {messages.map(m => {
                const author = profilesMap[m.user_id];
                const parent = m.parent_id ? messagesById[m.parent_id] : null;
                const parentAuthor = parent ? profilesMap[parent.user_id] : null;
                return (
                  <div key={m.id} className={`border-l-2 border-primary pl-3 py-1 flex items-start justify-between gap-2 ${parent ? "ml-6" : ""}`}>
                    <div className="flex-1 min-w-0">
                      {parent && (
                        <div className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 mb-1">
                          ↳ Responde a {parentAuthor ? `${parentAuthor.nombre} ${parentAuthor.apellidos}` : "—"}: <span className="opacity-70">{parent.contenido.slice(0, 60)}{parent.contenido.length > 60 ? "…" : ""}</span>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">{author ? `${author.nombre} ${author.apellidos}` : "—"} · {new Date(m.created_at).toLocaleString("es-ES")}</div>
                      <div className="text-sm whitespace-pre-wrap">{m.contenido}</div>
                      <Button variant="ghost" size="sm" className="h-7 px-2 mt-1 text-xs" onClick={() => setReplyTo(m)}>
                        <Reply className="h-3 w-3 mr-1" /> Responder
                      </Button>
                    </div>
                    {isSuperadmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive shrink-0"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar este mensaje?</AlertDialogTitle>
                            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMessage(m.id)}>Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                );
              })}
              <div className="space-y-2 pt-3 border-t">
                {replyTo && (
                  <div className="flex items-start justify-between bg-muted/40 rounded p-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">Respondiendo a {profilesMap[replyTo.user_id] ? `${profilesMap[replyTo.user_id].nombre} ${profilesMap[replyTo.user_id].apellidos}` : "—"}</div>
                      <div className="text-muted-foreground line-clamp-2">{replyTo.contenido}</div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyTo(null)}><X className="h-3 w-3" /></Button>
                  </div>
                )}
                <Textarea placeholder={replyTo ? "Escribe tu respuesta..." : "Escribe un mensaje al hilo..."} value={reply} onChange={(e) => setReply(e.target.value)} />
                <Button onClick={sendReply} disabled={!reply.trim()}>{replyTo ? "Responder" : "Publicar"}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
