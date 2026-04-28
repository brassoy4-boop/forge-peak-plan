import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Archive, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface MarkCategory { id: string; nombre: string; orden: number; status: string; }
interface Mark {
  id: string; category_id: string | null; nombre: string; value_type: string; unidad: string | null;
  mejor_mayor: boolean; status: string;
}

const VALUE_TYPES = ["tiempo", "distancia", "repeticiones", "peso", "puntuacion", "booleano", "texto"];

export default function Marcas() {
  const { primaryRole } = useAuth();
  const isCoach = primaryRole === "entrenador" || primaryRole === "superadmin";
  const [cats, setCats] = useState<MarkCategory[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [openCat, setOpenCat] = useState(false);
  const [openMark, setOpenMark] = useState(false);
  const [editingCat, setEditingCat] = useState<MarkCategory | null>(null);
  const [catForm, setCatForm] = useState({ nombre: "" });
  const [editingMark, setEditingMark] = useState<Mark | null>(null);
  const [markForm, setMarkForm] = useState({ nombre: "", category_id: "", value_type: "tiempo", unidad: "", mejor_mayor: false });
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("__all__");
  const [showArchived, setShowArchived] = useState(false);

  const load = async () => {
    const [c, m] = await Promise.all([
      supabase.from("mark_categories").select("*").order("orden"),
      supabase.from("marks").select("*").order("orden"),
    ]);
    setCats((c.data ?? []) as MarkCategory[]);
    setMarks((m.data ?? []) as Mark[]);
  };
  useEffect(() => { load(); }, []);

  const openCatDialog = (c?: MarkCategory) => {
    if (c) { setEditingCat(c); setCatForm({ nombre: c.nombre }); }
    else { setEditingCat(null); setCatForm({ nombre: "" }); }
    setOpenCat(true);
  };

  const saveCat = async () => {
    if (!catForm.nombre.trim()) return;
    if (editingCat) {
      const { error } = await supabase.from("mark_categories").update({ nombre: catForm.nombre }).eq("id", editingCat.id);
      if (error) return toast.error(error.message);
      toast.success("Categoría actualizada");
    } else {
      const { error } = await supabase.from("mark_categories").insert({ nombre: catForm.nombre });
      if (error) return toast.error(error.message);
      toast.success("Categoría creada");
    }
    setOpenCat(false); setEditingCat(null); setCatForm({ nombre: "" }); load();
  };

  const deleteCat = async (c: MarkCategory) => {
    const enUso = marks.some((m) => m.category_id === c.id);
    if (enUso) {
      return toast.error("No puedes eliminar una categoría con marcas asociadas. Reasigna o elimina las marcas primero.");
    }
    const { error } = await supabase.from("mark_categories").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Categoría eliminada"); load();
  };

  const openMarkDialog = (m?: Mark) => {
    if (m) {
      setEditingMark(m);
      setMarkForm({
        nombre: m.nombre, category_id: m.category_id ?? "",
        value_type: m.value_type, unidad: m.unidad ?? "", mejor_mayor: m.mejor_mayor,
      });
    } else {
      setEditingMark(null);
      setMarkForm({ nombre: "", category_id: "", value_type: "tiempo", unidad: "", mejor_mayor: false });
    }
    setOpenMark(true);
  };

  const saveMark = async () => {
    if (!markForm.nombre.trim()) return;
    const payload: any = { ...markForm, category_id: markForm.category_id || null };
    if (editingMark) {
      const { error } = await supabase.from("marks").update(payload).eq("id", editingMark.id);
      if (error) return toast.error(error.message);
      toast.success("Marca actualizada");
    } else {
      const { error } = await supabase.from("marks").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Marca creada");
    }
    setOpenMark(false); setEditingMark(null);
    setMarkForm({ nombre: "", category_id: "", value_type: "tiempo", unidad: "", mejor_mayor: false });
    load();
  };

  const toggleMarkStatus = async (m: Mark) => {
    const next = m.status === "activo" ? "archivado" : "activo";
    await supabase.from("marks").update({ status: next }).eq("id", m.id);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Catálogo de marcas"
        description="Categorías y pruebas configurables."
        actions={
          isCoach && (
            <div className="flex gap-2">
              <Dialog open={openCat} onOpenChange={setOpenCat}>
                <DialogTrigger asChild><Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Categoría</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nueva categoría</DialogTitle></DialogHeader>
                  <div className="space-y-2"><Label>Nombre</Label><Input value={catForm.nombre} onChange={(e) => setCatForm({ nombre: e.target.value })} /></div>
                  <DialogFooter><Button onClick={saveCat}>Guardar</Button></DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={openMark} onOpenChange={setOpenMark}>
                <DialogTrigger asChild><Button onClick={() => openMarkDialog()}><Plus className="mr-2 h-4 w-4" /> Marca</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editingMark ? "Editar marca" : "Nueva marca / prueba"}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2"><Label>Nombre</Label><Input value={markForm.nombre} onChange={(e) => setMarkForm({ ...markForm, nombre: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Categoría</Label>
                      <Select value={markForm.category_id} onValueChange={(v) => setMarkForm({ ...markForm, category_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                        <SelectContent>{cats.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Tipo</Label>
                        <Select value={markForm.value_type} onValueChange={(v) => setMarkForm({ ...markForm, value_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {VALUE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label>Unidad</Label><Input value={markForm.unidad} onChange={(e) => setMarkForm({ ...markForm, unidad: e.target.value })} /></div>
                    </div>
                    <div className="flex items-center gap-2"><input id="mm" type="checkbox" checked={markForm.mejor_mayor} onChange={(e) => setMarkForm({ ...markForm, mejor_mayor: e.target.checked })} /><Label htmlFor="mm">Mejor valor es mayor</Label></div>
                  </div>
                  <DialogFooter><Button onClick={saveMark}>Guardar</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )
        }
      />
      <Card>
        <CardHeader><CardTitle>Marcas configuradas ({marks.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="mb-4 flex flex-wrap gap-2 items-center">
            <Input className="max-w-xs" placeholder="Buscar marca..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas las categorías</SelectItem>
                {cats.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="text-sm flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Mostrar archivadas
            </label>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Categoría</TableHead><TableHead>Tipo</TableHead><TableHead>Unidad</TableHead><TableHead>Mejor</TableHead><TableHead>Estado</TableHead>{isCoach && <TableHead className="text-right">Acciones</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {marks.filter(m => {
                if (filterCat !== "__all__" && m.category_id !== filterCat) return false;
                if (!showArchived && m.status !== "activo") return false;
                if (search.trim() && !m.nombre.toLowerCase().includes(search.toLowerCase())) return false;
                return true;
              }).map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.nombre}</TableCell>
                  <TableCell>{cats.find(c => c.id === m.category_id)?.nombre ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{m.value_type}</Badge></TableCell>
                  <TableCell>{m.unidad}</TableCell>
                  <TableCell>{m.mejor_mayor ? "Mayor" : "Menor"}</TableCell>
                  <TableCell><Badge variant={m.status === "activo" ? "default" : "secondary"}>{m.status}</Badge></TableCell>
                  {isCoach && (
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => openMarkDialog(m)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleMarkStatus(m)} title={m.status === "activo" ? "Archivar" : "Reactivar"}>
                        {m.status === "activo" ? <Archive className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
