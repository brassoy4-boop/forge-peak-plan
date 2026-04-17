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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export default function Ejercicios() {
  const { primaryRole } = useAuth();
  const isCoach = primaryRole === "entrenador" || primaryRole === "superadmin";
  const [cats, setCats] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [openCat, setOpenCat] = useState(false);
  const [openEx, setOpenEx] = useState(false);
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
  const saveEx = async () => {
    const payload: any = { ...exForm, category_id: exForm.category_id || null };
    const { error } = await supabase.from("exercises").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Ejercicio creado"); setOpenEx(false);
    setExForm({ nombre: "", category_id: "", descripcion: "", imagen_url: "", instrucciones: "" });
    load();
  };

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
            <Dialog open={openEx} onOpenChange={setOpenEx}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Ejercicio</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuevo ejercicio</DialogTitle></DialogHeader>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((ex) => (
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
          </Card>
        ))}
        {items.length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">Sin ejercicios todavía.</p>}
      </div>
    </div>
  );
}
