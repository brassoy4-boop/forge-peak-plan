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
import { Badge } from "@/components/ui/badge";
import { Plus, Image as ImageIcon, Pencil, Archive, Power } from "lucide-react";
import { toast } from "sonner";

export default function Ejercicios() {
  const { primaryRole } = useAuth();
  const isCoach = primaryRole === "entrenador" || primaryRole === "superadmin";
  const [cats, setCats] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [filterCat, setFilterCat] = useState<string>("__all__");
  const [openCat, setOpenCat] = useState(false);
  const [openEx, setOpenEx] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [catForm, setCatForm] = useState({ nombre: "" });
  const [exForm, setExForm] = useState({ nombre: "", category_id: "", descripcion: "", imagen_url: "", instrucciones: "" });

  const load = async () => {
    const [c, e] = await Promise.all([
      supabase.from("exercise_categories").select("*").order("orden"),
      supabase.from("exercises").select("*").order("nombre"),
    ]);
    setCats(c.data ?? []); setItems(e.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const saveCat = async () => {
    const { error } = await supabase.from("exercise_categories").insert({ nombre: catForm.nombre });
    if (error) return toast.error(error.message);
    toast.success("Categoría creada"); setOpenCat(false); setCatForm({ nombre: "" }); load();
  };

  const openExDialog = (ex?: any) => {
    if (ex) {
      setEditing(ex);
      setExForm({
        nombre: ex.nombre, category_id: ex.category_id ?? "",
        descripcion: ex.descripcion ?? "", imagen_url: ex.imagen_url ?? "", instrucciones: ex.instrucciones ?? "",
      });
    } else {
      setEditing(null);
      setExForm({ nombre: "", category_id: "", descripcion: "", imagen_url: "", instrucciones: "" });
    }
    setOpenEx(true);
  };
  const saveEx = async () => {
    const payload: any = { ...exForm, category_id: exForm.category_id || null };
    if (editing) {
      const { error } = await supabase.from("exercises").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Ejercicio actualizado");
    } else {
      const { error } = await supabase.from("exercises").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Ejercicio creado");
    }
    _setOpenEx(false); setEditing(null);
    setExForm({ nombre: "", category_id: "", descripcion: "", imagen_url: "", instrucciones: "" });
    load();
  };

  const toggleStatus = async (ex: any) => {
    const next = ex.status === "activo" ? "archivado" : "activo";
    await supabase.from("exercises").update({ status: next }).eq("id", ex.id);
    load();
  };

  const visible = filterCat === "__all__" ? items : items.filter(i => i.category_id === filterCat);

  return (
    <div>
      <PageHeader title="Ejercicios" description="Catálogo de ejercicios e imágenes."
        actions={isCoach && (
          <div className="flex gap-2">
            <Dialog open={openCat} onOpenChange={setOpenCat}>
              <DialogTrigger asChild><Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Categoría</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nueva categoría</DialogTitle></DialogHeader>
                <div className="space-y-2"><Label>Nombre</Label><Input value={catForm.nombre} onChange={(e) => setCatForm({ nombre: e.target.value })} /></div>
                <DialogFooter><Button onClick={saveCat}>Guardar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={openEx} onOpenChange={_setOpenEx}>
              <DialogTrigger asChild><Button onClick={() => openEx()}><Plus className="mr-2 h-4 w-4" /> Ejercicio</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Editar ejercicio" : "Nuevo ejercicio"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2"><Label>Nombre</Label><Input value={exForm.nombre} onChange={(e) => setExForm({ ...exForm, nombre: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Categoría</Label>
                    <Select value={exForm.category_id} onValueChange={(v) => setExForm({ ...exForm, category_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                      <SelectContent>{cats.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>URL imagen</Label><Input value={exForm.imagen_url} onChange={(e) => setExForm({ ...exForm, imagen_url: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Descripción</Label><Textarea value={exForm.descripcion} onChange={(e) => setExForm({ ...exForm, descripcion: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Instrucciones</Label><Textarea value={exForm.instrucciones} onChange={(e) => setExForm({ ...exForm, instrucciones: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={saveEx}>Guardar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      />

      <div className="mb-4 max-w-xs">
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas las categorías</SelectItem>
            {cats.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((ex) => (
          <Card key={ex.id} className="overflow-hidden">
            <div className="aspect-video bg-muted flex items-center justify-center">
              {ex.imagen_url ? <img src={ex.imagen_url} alt={ex.nombre} className="w-full h-full object-cover" /> : <ImageIcon className="h-10 w-10 text-muted-foreground" />}
            </div>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg">{ex.nombre}</CardTitle>
                <Badge variant="outline">{cats.find(c => c.id === ex.category_id)?.nombre ?? "—"}</Badge>
              </div>
              {ex.descripcion && <p className="text-sm text-muted-foreground line-clamp-2">{ex.descripcion}</p>}
            </CardHeader>
            {isCoach && (
              <CardContent className="flex gap-2 pt-0">
                <Button size="sm" variant="outline" onClick={() => openEx(ex)}><Pencil className="h-3 w-3 mr-1" /> Editar</Button>
                <Button size="sm" variant="outline" onClick={() => toggleStatus(ex)}>
                  {ex.status === "activo" ? <><Archive className="h-3 w-3 mr-1" /> Archivar</> : <><Power className="h-3 w-3 mr-1" /> Reactivar</>}
                </Button>
              </CardContent>
            )}
          </Card>
        ))}
        {visible.length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">Sin ejercicios.</p>}
      </div>
    </div>
  );
}
