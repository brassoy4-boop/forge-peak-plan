import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trophy, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Oposicion {
  id: string; nombre: string; descripcion: string | null; imagen_url: string | null; status: string;
}

export default function Oposiciones() {
  const { primaryRole, user } = useAuth();
  const isCoach = primaryRole === "entrenador" || primaryRole === "superadmin";
  const [items, setItems] = useState<Oposicion[]>([]);
  const [misIds, setMisIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Oposicion | null>(null);
  const [form, setForm] = useState({ nombre: "", descripcion: "", imagen_url: "" });

  const load = async () => {
    const { data } = await supabase.from("oposiciones").select("*").order("nombre");
    setItems((data ?? []) as Oposicion[]);
    if (user && primaryRole === "usuario") {
      const { data: uo } = await supabase.from("user_oposiciones").select("oposicion_id").eq("user_id", user.id);
      setMisIds(new Set((uo ?? []).map((x) => x.oposicion_id)));
    }
  };

  useEffect(() => { load(); }, [user, primaryRole]);

  const onSave = async () => {
    if (!form.nombre.trim()) { toast.error("Nombre requerido"); return; }
    if (editing) {
      const { error } = await supabase.from("oposiciones").update(form).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Oposición actualizada");
    } else {
      const { error } = await supabase.from("oposiciones").insert({ ...form, created_by: user?.id });
      if (error) return toast.error(error.message);
      toast.success("Oposición creada");
    }
    setOpen(false); setEditing(null); setForm({ nombre: "", descripcion: "", imagen_url: "" });
    load();
  };

  const visibles = primaryRole === "usuario" ? items.filter((i) => misIds.has(i.id)) : items;

  return (
    <div>
      <PageHeader
        title={primaryRole === "usuario" ? "Mis oposiciones" : "Oposiciones"}
        description="Catálogo de oposiciones y pruebas físicas."
        actions={
          isCoach && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditing(null); setForm({ nombre: "", descripcion: "", imagen_url: "" }); }}>
                  <Plus className="mr-2 h-4 w-4" /> Nueva oposición
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Editar" : "Nueva"} oposición</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Nombre</Label><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Descripción</Label><Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
                  <div className="space-y-2"><Label>URL de imagen</Label><Input value={form.imagen_url} onChange={(e) => setForm({ ...form, imagen_url: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={onSave}>Guardar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />
      {visibles.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No hay oposiciones {primaryRole === "usuario" ? "asignadas a ti" : "todavía"}.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibles.map((o) => (
            <Card key={o.id} className="overflow-hidden">
              <div className="aspect-video bg-secondary flex items-center justify-center">
                {o.imagen_url ? <img src={o.imagen_url} alt={o.nombre} className="w-full h-full object-cover" /> : <Trophy className="h-12 w-12 text-primary" />}
              </div>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="brand-title">{o.nombre}</CardTitle>
                  <Badge variant={o.status === "activo" ? "default" : "secondary"}>{o.status}</Badge>
                </div>
                {o.descripcion && <CardDescription>{o.descripcion}</CardDescription>}
              </CardHeader>
              {isCoach && (
                <CardContent>
                  <Button variant="outline" size="sm" onClick={() => { setEditing(o); setForm({ nombre: o.nombre, descripcion: o.descripcion ?? "", imagen_url: o.imagen_url ?? "" }); setOpen(true); }}>
                    <Pencil className="mr-2 h-3 w-3" /> Editar
                  </Button>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
