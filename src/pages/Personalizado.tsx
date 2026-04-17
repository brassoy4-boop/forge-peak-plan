import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, FileText } from "lucide-react";
import { toast } from "sonner";

export default function Personalizado() {
  const { user, primaryRole } = useAuth();
  const isCoach = primaryRole === "entrenador" || primaryRole === "superadmin";
  const [items, setItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ user_id: "", titulo: "", contenido: "" });
  const [selected, setSelected] = useState<any | null>(null);
  const [versions, setVersions] = useState<any[]>([]);

  const load = async () => {
    const [t, u] = await Promise.all([
      supabase.from("personalized_trainings").select("*, profiles!personalized_trainings_user_id_fkey(nombre, apellidos)").order("created_at", { ascending: false }),
      isCoach ? supabase.from("profiles").select("user_id, nombre, apellidos") : Promise.resolve({ data: [] } as any),
    ]);
    setItems(t.data ?? []); setUsers(u.data ?? []);
  };
  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!selected) return;
    supabase.from("personalized_training_versions").select("*").eq("training_id", selected.id).order("version", { ascending: false }).then(({ data }) => setVersions(data ?? []));
  }, [selected]);

  const create = async () => {
    if (!form.user_id || !form.titulo) return toast.error("Datos incompletos");
    const { data, error } = await supabase.from("personalized_trainings").insert({
      user_id: form.user_id, titulo: form.titulo, coach_id: user?.id, current_version: 1,
    }).select().single();
    if (error) return toast.error(error.message);
    await supabase.from("personalized_training_versions").insert({
      training_id: data.id, version: 1, bloques: [{ tipo: "texto", contenido: form.contenido }] as any, created_by: user?.id,
    });
    toast.success("Ficha creada"); setOpen(false); setForm({ user_id: "", titulo: "", contenido: "" }); load();
  };

  return (
    <div>
      <PageHeader title="Entrenamientos personalizados" description="Fichas avanzadas con bloques versionables."
        actions={isCoach && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Nueva ficha</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nueva ficha</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2"><Label>Usuario</Label>
                  <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.nombre} {u.apellidos}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
                <div className="space-y-2"><Label>Contenido inicial (bloque texto)</Label><Textarea rows={6} value={form.contenido} onChange={(e) => setForm({ ...form, contenido: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={create}>Crear</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />
      {!selected ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((i) => (
            <Card key={i.id} className="cursor-pointer hover:border-primary" onClick={() => setSelected(i)}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />{i.titulo}</CardTitle>
                <p className="text-sm text-muted-foreground">{i.profiles?.nombre} {i.profiles?.apellidos} · v{i.current_version}</p>
              </CardHeader>
            </Card>
          ))}
          {items.length === 0 && <p className="col-span-full text-center text-muted-foreground py-8">Sin fichas.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => setSelected(null)}>← Volver</Button>
          <Card>
            <CardHeader><CardTitle className="brand-title text-2xl">{selected.titulo}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {versions.map(v => (
                <div key={v.id} className="border-l-2 border-primary pl-4">
                  <div className="text-xs text-muted-foreground mb-1">Versión {v.version} · {new Date(v.created_at).toLocaleDateString("es-ES")}</div>
                  {(v.bloques as any[])?.map((b, idx) => (
                    <div key={idx} className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">{b.contenido}</div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
