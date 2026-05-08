import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { NIVEL_COLORS } from "@/lib/baremos";

const NIVELES = ["insuficiente", "medio", "bueno", "excelente"];

export default function Baremos() {
  const { primaryRole } = useAuth();
  const isCoach = primaryRole === "entrenador" || primaryRole === "superadmin";
  const [marks, setMarks] = useState<any[]>([]);
  const [oposiciones, setOposiciones] = useState<any[]>([]);
  const [baremos, setBaremos] = useState<any[]>([]);
  const [filterMark, setFilterMark] = useState("");
  const [form, setForm] = useState({
    mark_id: "", oposicion_id: "__any__", sexo: "unisex",
    nivel: "medio", valor_min: "", valor_max: "", orden: 0,
  });

  const load = async () => {
    const [m, o, b] = await Promise.all([
      supabase.from("marks").select("id, nombre, unidad, value_type").eq("status", "activo").order("nombre"),
      supabase.from("oposiciones").select("id, nombre"),
      supabase.from("mark_baremos").select("*").order("orden"),
    ]);
    setMarks(m.data ?? []); setOposiciones(o.data ?? []); setBaremos(b.data ?? []);
  };
  useEffect(() => { load(); }, []);

  if (!isCoach) return <Navigate to="/app" replace />;

  const save = async () => {
    if (!form.mark_id || !form.nivel) return toast.error("Marca y nivel obligatorios");
    const { error } = await supabase.from("mark_baremos").insert({
      mark_id: form.mark_id,
      oposicion_id: form.oposicion_id === "__any__" ? null : form.oposicion_id,
      sexo: form.sexo as any,
      nivel: form.nivel,
      valor_min: form.valor_min === "" ? null : Number(form.valor_min),
      valor_max: form.valor_max === "" ? null : Number(form.valor_max),
      orden: Number(form.orden) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("Baremo añadido");
    setForm({ ...form, valor_min: "", valor_max: "", orden: form.orden + 1 });
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("mark_baremos").delete().eq("id", id);
    load();
  };

  const filtered = filterMark ? baremos.filter(b => b.mark_id === filterMark) : baremos;

  return (
    <div>
      <PageHeader title="Baremos de referencia" description="Define franjas (insuficiente / medio / bueno / excelente) por marca, oposición y sexo." />

      <Card className="mb-6">
        <CardContent className="pt-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Marca</Label>
              <Select value={form.mark_id} onValueChange={(v) => setForm({ ...form, mark_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar marca" /></SelectTrigger>
                <SelectContent>{marks.map(m => <SelectItem key={m.id} value={m.id}>{m.nombre} ({m.unidad ?? "—"})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Oposición</Label>
              <Select value={form.oposicion_id} onValueChange={(v) => setForm({ ...form, oposicion_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Cualquiera</SelectItem>
                  {oposiciones.map(o => <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Sexo</Label>
              <Select value={form.sexo} onValueChange={(v) => setForm({ ...form, sexo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unisex">Unisex</SelectItem>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="femenino">Femenino</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-2"><Label>Nivel</Label>
              <Select value={form.nivel} onValueChange={(v) => setForm({ ...form, nivel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{NIVELES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Valor mín</Label><Input type="number" step="any" value={form.valor_min} onChange={(e) => setForm({ ...form, valor_min: e.target.value })} /></div>
            <div className="space-y-2"><Label>Valor máx</Label><Input type="number" step="any" value={form.valor_max} onChange={(e) => setForm({ ...form, valor_max: e.target.value })} /></div>
            <div className="space-y-2"><Label>Orden</Label><Input type="number" value={form.orden} onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })} /></div>
          </div>
          <Button onClick={save}><Plus className="h-4 w-4 mr-2" /> Añadir baremo</Button>
        </CardContent>
      </Card>

      <div className="mb-3 max-w-sm">
        <Select value={filterMark || "__all__"} onValueChange={(v) => setFilterMark(v === "__all__" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Filtrar por marca" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas las marcas</SelectItem>
            {marks.map(m => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marca</TableHead><TableHead>Oposición</TableHead><TableHead>Sexo</TableHead>
                  <TableHead>Nivel</TableHead><TableHead>Mín</TableHead><TableHead>Máx</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{marks.find(m => m.id === b.mark_id)?.nombre ?? "—"}</TableCell>
                    <TableCell>{oposiciones.find(o => o.id === b.oposicion_id)?.nombre ?? "Cualquiera"}</TableCell>
                    <TableCell><Badge variant="outline">{b.sexo}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={NIVEL_COLORS[b.nivel] ?? ""}>{b.nivel}</Badge></TableCell>
                    <TableCell>{b.valor_min ?? "−∞"}</TableCell>
                    <TableCell>{b.valor_max ?? "+∞"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin baremos.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-2">
            {filtered.map((b) => (
              <div key={b.id} className="rounded-md border bg-card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{marks.find(m => m.id === b.mark_id)?.nombre ?? "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">{oposiciones.find(o => o.id === b.oposicion_id)?.nombre ?? "Cualquiera"}</div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
                <div className="flex flex-wrap gap-1 text-xs">
                  <Badge variant="outline">{b.sexo}</Badge>
                  <Badge variant="outline" className={NIVEL_COLORS[b.nivel] ?? ""}>{b.nivel}</Badge>
                  <Badge variant="outline">{(b.valor_min ?? "−∞")} – {(b.valor_max ?? "+∞")}</Badge>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center text-muted-foreground py-8 text-sm">Sin baremos.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
