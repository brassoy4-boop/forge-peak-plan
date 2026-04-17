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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface MarkCategory { id: string; nombre: string; orden: number; status: string; }
interface Mark {
  id: string; category_id: string | null; nombre: string; value_type: string; unidad: string | null;
  mejor_mayor: boolean; status: string;
}

export default function Marcas() {
  const { primaryRole } = useAuth();
  const isCoach = primaryRole === "entrenador" || primaryRole === "superadmin";
  const [cats, setCats] = useState<MarkCategory[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [openCat, setOpenCat] = useState(false);
  const [openMark, setOpenMark] = useState(false);
  const [catForm, setCatForm] = useState({ nombre: "" });
  const [markForm, setMarkForm] = useState({ nombre: "", category_id: "", value_type: "tiempo", unidad: "", mejor_mayor: false });

  const load = async () => {
    const [c, m] = await Promise.all([
      supabase.from("mark_categories").select("*").order("orden"),
      supabase.from("marks").select("*").order("orden"),
    ]);
    setCats((c.data ?? []) as MarkCategory[]);
    setMarks((m.data ?? []) as Mark[]);
  };
  useEffect(() => { load(); }, []);

  const saveCat = async () => {
    if (!catForm.nombre.trim()) return;
    const { error } = await supabase.from("mark_categories").insert({ nombre: catForm.nombre });
    if (error) return toast.error(error.message);
    toast.success("Categoría creada"); setOpenCat(false); setCatForm({ nombre: "" }); load();
  };
  const saveMark = async () => {
    if (!markForm.nombre.trim()) return;
    const payload: any = { ...markForm, category_id: markForm.category_id || null };
    const { error } = await supabase.from("marks").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Marca creada"); setOpenMark(false);
    setMarkForm({ nombre: "", category_id: "", value_type: "tiempo", unidad: "", mejor_mayor: false });
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
                <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Marca</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nueva marca / prueba</DialogTitle></DialogHeader>
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
                            {["tiempo","distancia","repeticiones","peso","puntuacion","booleano","texto"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
        <CardHeader><CardTitle>Marcas configuradas</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Categoría</TableHead><TableHead>Tipo</TableHead><TableHead>Unidad</TableHead><TableHead>Mejor</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
            <TableBody>
              {marks.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.nombre}</TableCell>
                  <TableCell>{cats.find(c => c.id === m.category_id)?.nombre ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{m.value_type}</Badge></TableCell>
                  <TableCell>{m.unidad}</TableCell>
                  <TableCell>{m.mejor_mayor ? "Mayor" : "Menor"}</TableCell>
                  <TableCell><Badge variant={m.status === "activo" ? "default" : "secondary"}>{m.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
