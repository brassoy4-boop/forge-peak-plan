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
import { Badge } from "@/components/ui/badge";
import { Plus, Target } from "lucide-react";
import { toast } from "sonner";

export default function Simulacros() {
  const { user, primaryRole } = useAuth();
  const isCoach = primaryRole === "entrenador" || primaryRole === "superadmin";
  const [templates, setTemplates] = useState<any[]>([]);
  const [oposiciones, setOposiciones] = useState<any[]>([]);
  const [marks, setMarks] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nombre: "", oposicion_id: "", sexo: "unisex", descripcion: "", mark_ids: [] as string[] });
  const [running, setRunning] = useState<any | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [obs, setObs] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [users, setUsers] = useState<any[]>([]);

  const load = async () => {
    const [t, o, m, e, u] = await Promise.all([
      supabase.from("simulacro_templates").select("*, oposiciones(nombre), simulacro_template_marks(mark_id, marks(nombre, unidad, value_type))"),
      supabase.from("oposiciones").select("*"),
      supabase.from("marks").select("*").eq("status", "activo").order("nombre"),
      user ? supabase.from("simulacro_executions").select("*, simulacro_templates(nombre, oposiciones(nombre))").order("fecha", { ascending: false }).limit(20) : Promise.resolve({ data: [] } as any),
      isCoach ? supabase.from("profiles").select("user_id, nombre, apellidos") : Promise.resolve({ data: [] } as any),
    ]);
    setTemplates(t.data ?? []); setOposiciones(o.data ?? []); setMarks(m.data ?? []);
    setExecutions(e.data ?? []); setUsers(u.data ?? []);
  };
  useEffect(() => { load(); }, [user, primaryRole]);

  const createTpl = async () => {
    if (!form.nombre || !form.oposicion_id) return toast.error("Faltan datos");
    const { data, error } = await supabase.from("simulacro_templates").insert({
      nombre: form.nombre, oposicion_id: form.oposicion_id, sexo: form.sexo as any, descripcion: form.descripcion,
      status: "activo", created_by: user?.id,
    }).select().single();
    if (error) return toast.error(error.message);
    if (form.mark_ids.length) {
      await supabase.from("simulacro_template_marks").insert(
        form.mark_ids.map((mark_id, i) => ({ template_id: data.id, mark_id, orden: i }))
      );
    }
    toast.success("Simulacro creado"); setOpen(false);
    setForm({ nombre: "", oposicion_id: "", sexo: "unisex", descripcion: "", mark_ids: [] });
    load();
  };

  const startRun = (tpl: any) => {
    setRunning(tpl);
    setResults({}); setObs(""); setTargetUserId(user?.id ?? "");
  };

  const saveRun = async () => {
    if (!running || !targetUserId) return;
    const { data: ex, error } = await supabase.from("simulacro_executions").insert({
      template_id: running.id, user_id: targetUserId, coach_id: isCoach ? user?.id : null, observaciones: obs,
    }).select().single();
    if (error) return toast.error(error.message);
    const rows = Object.entries(results).filter(([_, v]) => v).map(([mark_id, valor]) => ({
      execution_id: ex.id, mark_id, valor_numerico: Number(valor) || null, valor_texto: isNaN(Number(valor)) ? valor : null,
    }));
    if (rows.length) {
      await supabase.from("simulacro_results").insert(rows);
      // also save to mark_records
      await supabase.from("mark_records").insert(rows.map(r => ({
        user_id: targetUserId, mark_id: r.mark_id, valor_numerico: r.valor_numerico, valor_texto: r.valor_texto,
        origen: "simulacro" as const, origen_ref: ex.id, registrado_por: user?.id,
      })));
    }
    toast.success("Resultados guardados"); setRunning(null); load();
  };

  return (
    <div>
      <PageHeader title="Simulacros" description="Plantillas de simulacro y ejecuciones."
        actions={isCoach && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Nuevo simulacro</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Nueva plantilla de simulacro</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2"><Label>Nombre</Label><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Oposición</Label>
                    <Select value={form.oposicion_id} onValueChange={(v) => setForm({ ...form, oposicion_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>{oposiciones.map(o => <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>)}</SelectContent>
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
                <div className="space-y-2"><Label>Pruebas</Label>
                  <div className="border rounded p-2 max-h-48 overflow-y-auto space-y-1">
                    {marks.map(m => (
                      <label key={m.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={form.mark_ids.includes(m.id)} onChange={(e) => {
                          setForm({ ...form, mark_ids: e.target.checked ? [...form.mark_ids, m.id] : form.mark_ids.filter(i => i !== m.id) });
                        }} />
                        <span>{m.nombre} <span className="text-muted-foreground">({m.unidad})</span></span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter><Button onClick={createTpl}>Crear</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />

      {running && (
        <Card className="mb-6 border-primary">
          <CardHeader><CardTitle>Registrar: {running.nombre}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {isCoach && (
              <div className="space-y-2"><Label>Usuario</Label>
                <Select value={targetUserId} onValueChange={setTargetUserId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona usuario" /></SelectTrigger>
                  <SelectContent>{users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.nombre} {u.apellidos}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {running.simulacro_template_marks?.map((stm: any) => (
              <div key={stm.mark_id} className="grid grid-cols-3 items-center gap-2">
                <Label>{stm.marks?.nombre}</Label>
                <Input placeholder={stm.marks?.unidad ?? ""} value={results[stm.mark_id] ?? ""} onChange={(e) => setResults({ ...results, [stm.mark_id]: e.target.value })} />
                <span className="text-xs text-muted-foreground">{stm.marks?.unidad}</span>
              </div>
            ))}
            <div className="space-y-2"><Label>Observaciones</Label><Input value={obs} onChange={(e) => setObs(e.target.value)} /></div>
            <div className="flex gap-2"><Button onClick={saveRun}>Guardar</Button><Button variant="outline" onClick={() => setRunning(null)}>Cancelar</Button></div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="brand-title text-xl flex items-center gap-2"><Target className="h-5 w-5 text-primary" />{t.nombre}</CardTitle>
                <Badge variant="outline">{t.sexo}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{t.oposiciones?.nombre} · {t.simulacro_template_marks?.length ?? 0} pruebas</p>
            </CardHeader>
            <CardContent>
              <Button size="sm" onClick={() => startRun(t)}>Registrar resultado</Button>
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && <p className="col-span-full text-center text-muted-foreground py-8">No hay plantillas todavía.</p>}
      </div>

      <div className="mt-8">
        <h2 className="brand-title text-2xl mb-3">Histórico</h2>
        <div className="space-y-2">
          {executions.map((e) => (
            <Card key={e.id}>
              <CardContent className="py-3 flex justify-between items-center">
                <div>
                  <div className="font-medium">{e.simulacro_templates?.nombre}</div>
                  <div className="text-xs text-muted-foreground">{e.simulacro_templates?.oposiciones?.nombre} · {new Date(e.fecha).toLocaleString("es-ES")}</div>
                </div>
              </CardContent>
            </Card>
          ))}
          {executions.length === 0 && <p className="text-muted-foreground text-center py-4">Sin ejecuciones.</p>}
        </div>
      </div>
    </div>
  );
}
