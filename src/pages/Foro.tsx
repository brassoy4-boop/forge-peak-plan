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
import { MessageSquare, Plus } from "lucide-react";
import { toast } from "sonner";

export default function Foro() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ titulo: "", contenido: "" });
  const [reply, setReply] = useState("");

  const loadThreads = async () => {
    const { data } = await supabase.from("forum_threads").select("*, profiles!forum_threads_created_by_fkey(nombre, apellidos)").order("updated_at", { ascending: false });
    setThreads(data ?? []);
  };
  useEffect(() => { loadThreads(); }, []);
  useEffect(() => {
    if (!selected) return;
    supabase.from("forum_messages").select("*, profiles!forum_messages_user_id_fkey(nombre, apellidos)").eq("thread_id", selected.id).order("created_at")
      .then(({ data }) => setMessages(data ?? []));
  }, [selected]);

  const createThread = async () => {
    if (!user || !form.titulo) return;
    const { data, error } = await supabase.from("forum_threads").insert({ titulo: form.titulo, created_by: user.id }).select().single();
    if (error) return toast.error(error.message);
    if (form.contenido) await supabase.from("forum_messages").insert({ thread_id: data.id, user_id: user.id, contenido: form.contenido });
    toast.success("Hilo creado"); setOpen(false); setForm({ titulo: "", contenido: "" }); loadThreads();
  };

  const sendReply = async () => {
    if (!user || !selected || !reply.trim()) return;
    const { error } = await supabase.from("forum_messages").insert({ thread_id: selected.id, user_id: user.id, contenido: reply });
    if (error) return toast.error(error.message);
    setReply("");
    const { data } = await supabase.from("forum_messages").select("*, profiles!forum_messages_user_id_fkey(nombre, apellidos)").eq("thread_id", selected.id).order("created_at");
    setMessages(data ?? []);
  };

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
                <div className="space-y-2"><Label>Mensaje inicial</Label><Textarea value={form.contenido} onChange={(e) => setForm({ ...form, contenido: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={createThread}>Publicar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {!selected ? (
        <div className="space-y-2">
          {threads.map(t => (
            <Card key={t.id} className="cursor-pointer hover:border-primary" onClick={() => setSelected(t)}>
              <CardContent className="py-3 flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.titulo}</div>
                  <div className="text-xs text-muted-foreground">{t.profiles?.nombre} {t.profiles?.apellidos} · {new Date(t.updated_at).toLocaleDateString("es-ES")}</div>
                </div>
              </CardContent>
            </Card>
          ))}
          {threads.length === 0 && <p className="text-center text-muted-foreground py-8">Sin hilos todavía.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => setSelected(null)}>← Volver</Button>
          <Card>
            <CardHeader><CardTitle className="brand-title text-2xl">{selected.titulo}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {messages.map(m => (
                <div key={m.id} className="border-l-2 border-primary pl-3 py-1">
                  <div className="text-xs text-muted-foreground">{m.profiles?.nombre} {m.profiles?.apellidos} · {new Date(m.created_at).toLocaleString("es-ES")}</div>
                  <div className="text-sm whitespace-pre-wrap">{m.contenido}</div>
                </div>
              ))}
              <div className="space-y-2 pt-3 border-t">
                <Textarea placeholder="Escribe una respuesta..." value={reply} onChange={(e) => setReply(e.target.value)} />
                <Button onClick={sendReply} disabled={!reply.trim()}>Responder</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
