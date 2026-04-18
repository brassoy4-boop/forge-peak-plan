import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { fetchBaremos, findNivel, NIVEL_COLORS, type Baremo } from "@/lib/baremos";

export default function Evolucion() {
  const { user, primaryRole } = useAuth();
  const isCoach = primaryRole === "entrenador" || primaryRole === "superadmin";
  const [marks, setMarks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedMark, setSelectedMark] = useState<string>("");
  const [records, setRecords] = useState<any[]>([]);
  const [baremos, setBaremos] = useState<Baremo[]>([]);
  const [profileSexo, setProfileSexo] = useState<string | null>(null);
  const [userOpoId, setUserOpoId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("marks").select("*").eq("status", "activo").then(({ data }) => {
      setMarks(data ?? []);
      if (data?.length && !selectedMark) setSelectedMark(data[0].id);
    });
    if (isCoach) supabase.from("profiles").select("user_id, nombre, apellidos").then(({ data }) => setUsers(data ?? []));
    if (user && !isCoach) setSelectedUser(user.id);
  }, [user, isCoach]);

  useEffect(() => {
    const uid = isCoach ? selectedUser : user?.id;
    if (!uid || !selectedMark) return;
    supabase.from("mark_records").select("*").eq("user_id", uid).eq("mark_id", selectedMark).order("fecha")
      .then(({ data }) => setRecords(data ?? []));
    supabase.from("profiles").select("sexo").eq("user_id", uid).maybeSingle()
      .then(({ data }) => setProfileSexo(data?.sexo ?? null));
    supabase.from("user_oposiciones").select("oposicion_id").eq("user_id", uid).limit(1).maybeSingle()
      .then(({ data }) => setUserOpoId(data?.oposicion_id ?? null));
  }, [user, selectedUser, selectedMark, isCoach]);

  useEffect(() => {
    if (!selectedMark) return;
    fetchBaremos(selectedMark, profileSexo, userOpoId).then(setBaremos);
  }, [selectedMark, profileSexo, userOpoId]);

  const mark = marks.find(m => m.id === selectedMark);
  const chartData = records.map(r => ({
    fecha: new Date(r.fecha).toLocaleDateString("es-ES"),
    valor: Number(r.valor_numerico) || 0,
  }));
  const best = mark && records.length
    ? (mark.mejor_mayor ? Math.max(...records.map(r => Number(r.valor_numerico) || 0)) : Math.min(...records.map(r => Number(r.valor_numerico) || Infinity)))
    : null;
  const last = records.length ? Number(records[records.length - 1].valor_numerico) : null;
  const lastNivel = last != null ? findNivel(baremos, last) : null;
  const bestNivel = best != null && best !== Infinity ? findNivel(baremos, best as number) : null;

  const exportCsv = () => {
    if (!records.length) return;
    const header = "Fecha,Valor,Unidad,Origen,Observaciones\n";
    const rows = records.map(r => `${new Date(r.fecha).toISOString()},${r.valor_numerico ?? r.valor_texto ?? ""},${r.unidad ?? mark?.unidad ?? ""},${r.origen ?? ""},"${(r.observaciones ?? "").replace(/"/g, '""')}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `evolucion-${mark?.nombre ?? "marca"}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title={isCoach ? "Analítica" : "Mi evolución"}
        description="Evolución de marcas en el tiempo."
        actions={<Button variant="outline" onClick={exportCsv} disabled={!records.length}><Download className="mr-2 h-4 w-4" /> Exportar CSV</Button>}
      />
      <Card className="mb-6">
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {isCoach && (
            <div className="space-y-2"><Label>Usuario</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger><SelectValue placeholder="Seleccionar usuario" /></SelectTrigger>
                <SelectContent>{users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.nombre} {u.apellidos}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2"><Label>Marca</Label>
            <Select value={selectedMark} onValueChange={setSelectedMark}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{marks.map(m => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm uppercase text-muted-foreground">Mejor</CardTitle></CardHeader>
          <CardContent>
            <div className="brand-title text-3xl text-primary">{best ?? "—"}</div>
            {bestNivel && <Badge variant="outline" className={`mt-2 ${NIVEL_COLORS[bestNivel.nivel] ?? ""}`}>{bestNivel.nivel}</Badge>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm uppercase text-muted-foreground">Última</CardTitle></CardHeader>
          <CardContent>
            <div className="brand-title text-3xl">{last ?? "—"}</div>
            {lastNivel && <Badge variant="outline" className={`mt-2 ${NIVEL_COLORS[lastNivel.nivel] ?? ""}`}>{lastNivel.nivel}</Badge>}
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm uppercase text-muted-foreground">Registros</CardTitle></CardHeader><CardContent><div className="brand-title text-3xl">{records.length}</div></CardContent></Card>
      </div>
      {baremos.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Baremo de referencia</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {[...baremos].sort((a, b) => a.orden - b.orden).map(b => (
              <Badge key={b.id} variant="outline" className={NIVEL_COLORS[b.nivel] ?? ""}>
                {b.nivel}: {b.valor_min ?? "−∞"} – {b.valor_max ?? "+∞"} {mark?.unidad ?? ""}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>Evolución</CardTitle></CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="fecha" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">Sin datos suficientes.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
