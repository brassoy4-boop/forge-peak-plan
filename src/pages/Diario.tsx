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
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function Diario() {
  const { user, primaryRole } = useAuth();
  const [fields, setFields] = useState<any[]>([]);
  const [sessionTypes, setSessionTypes] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [form, setForm] = useState({ session_type_id: "", descripcion: "", molestias: "", completado: "si", marca_clave: "", observaciones: "" });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const [f, st, e] = await Promise.all([
      supabase.from("diary_field_configs").select("*").eq("status", "activo").order("orden"),
      supabase.from("session_types").select("*").eq("status", "activo").order("orden"),
      user ? supabase.from("diary_entries").select("*, session_types(nombre)").eq("user_id", user.id).order("fecha", { ascending: false }).limit(20) : Promise.resolve({ data: [] } as any),
    ]);
    setFields(f.data ?? []); setSessionTypes(st.data ?? []); setEntries(e.data ?? []);
    const init: Record<string, number> = {}; (f.data ?? []).forEach((x: any) => init[x.id] = 5);
    setValues(init);
  };
  useEffect(() => { load(); }, [user]);

  const save = async () => {
    if (!user) return;
    const payload: any = { ...form, user_id: user.id, session_type_id: form.session_type_id || null };
    const { data, error } = await supabase.from("diary_entries").insert(payload).select().single();
    if (error) return toast.error(error.message);
    const valueRows = Object.entries(values).map(([field_id, v]) => ({ entry_id: data.id, field_id, valor: String(v) }));
    if (valueRows.length) await supabase.from("diary_entry_values").insert(valueRows);
    toast.success("Entrada guardada"); setCreating(false);
    setForm({ session_type_id: "", descripcion: "", molestias: "", completado: "si", marca_clave: "", observaciones: "" });
    load();
  };

  return (
    <div>
      <PageHeader title="Diario de entrenamiento" description="Registra cada sesión, sensaciones y resultados."
        actions={primaryRole === "usuario" && <Button onClick={() => setCreating(!creating)}><Plus className="mr-2 h-4 w-4" /> Nueva entrada</Button>}
      />
      {creating && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Nueva entrada</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Tipo de sesión</Label>
                <Select value={form.session_type_id} onValueChange={(v) => setForm({ ...form, session_type_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                  <SelectContent>{sessionTypes.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>¿Completaste las series?</Label>
                <Select value={form.completado} onValueChange={(v) => setForm({ ...form, completado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="si">Sí</SelectItem><SelectItem value="parcial">Parcial</SelectItem><SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Descripción del entrenamiento</Label><Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
            {fields.map((f) => (
              <div key={f.id} className="space-y-2">
                <div className="flex justify-between"><Label>{f.label}</Label><span className="text-sm font-medium text-primary">{values[f.id] ?? 5}</span></div>
                <Slider min={f.config?.min ?? 1} max={f.config?.max ?? 10} step={1} value={[values[f.id] ?? 5]} onValueChange={(v) => setValues({ ...values, [f.id]: v[0] })} />
              </div>
            ))}
            <div className="space-y-2"><Label>Molestias / lesiones</Label><Textarea value={form.molestias} onChange={(e) => setForm({ ...form, molestias: e.target.value })} /></div>
            <div className="space-y-2"><Label>Marca / resultado clave</Label><Input value={form.marca_clave} onChange={(e) => setForm({ ...form, marca_clave: e.target.value })} /></div>
            <div className="space-y-2"><Label>Observaciones</Label><Textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></div>
            <div className="flex gap-2"><Button onClick={save}>Guardar</Button><Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button></div>
          </CardContent>
        </Card>
      )}
      <div className="space-y-3">
        {entries.map((e) => (
          <Card key={e.id}>
            <CardHeader>
              <div className="flex justify-between">
                <CardTitle className="text-base">{new Date(e.fecha).toLocaleDateString("es-ES")} · {e.session_types?.nombre ?? "Sin tipo"}</CardTitle>
                <span className="text-xs text-muted-foreground">{e.completado}</span>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {e.descripcion && <p>{e.descripcion}</p>}
              {e.marca_clave && <p><strong>Marca clave:</strong> {e.marca_clave}</p>}
              {e.molestias && <p className="text-destructive"><strong>Molestias:</strong> {e.molestias}</p>}
            </CardContent>
          </Card>
        ))}
        {entries.length === 0 && !creating && <p className="text-center text-muted-foreground py-8">Sin entradas todavía.</p>}
      </div>
    </div>
  );
}
