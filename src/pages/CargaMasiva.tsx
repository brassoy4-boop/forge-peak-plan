import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Save, Calculator } from "lucide-react";

/**
 * Carga masiva tipo Excel
 * - Selección de marcas
 * - Grid editable (filas = usuarios, columnas = marcas)
 * - Cálculos automáticos: VAM, VO2max, ritmo
 * - Guardado masivo en mark_records (cada usuario sólo verá sus filas por RLS)
 */
export default function CargaMasiva() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [marks, setMarks] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedMarks, setSelectedMarks] = useState<Set<string>>(new Set());
  const [grid, setGrid] = useState<Record<string, Record<string, string>>>({});
  const [testLabel, setTestLabel] = useState("Test 1");

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("user_id, nombre, apellidos"),
      supabase.from("marks").select("*").eq("status", "activo").order("nombre"),
    ]).then(([p, m]) => {
      setProfiles(p.data ?? []); setMarks(m.data ?? []);
    });
  }, []);

  const setCell = (userId: string, markId: string, value: string) => {
    setGrid(prev => ({ ...prev, [userId]: { ...(prev[userId] ?? {}), [markId]: value } }));
  };

  // Cálculos: VAM (km/h) desde 1000m (tiempo en seg), VO2max ≈ VAM * 3.5, ritmo (min/km)
  const compute = (userRow: Record<string, string>) => {
    const m1000 = marks.find(m => m.nombre.toLowerCase().includes("1000"));
    if (!m1000) return null;
    const t = Number(userRow[m1000.id]);
    if (!t || t <= 0) return null;
    const vam = (1000 / t) * 3.6; // km/h
    const vo2 = vam * 3.5;
    const ritmo = t / 60; // min/km (ya 1km)
    return { vam: vam.toFixed(2), vo2: vo2.toFixed(1), ritmo: ritmo.toFixed(2) };
  };

  const usuariosVisibles = useMemo(() => profiles.filter(p => selectedUsers.size === 0 || selectedUsers.has(p.user_id)), [profiles, selectedUsers]);
  const marcasVisibles = useMemo(() => marks.filter(m => selectedMarks.has(m.id)), [marks, selectedMarks]);

  const saveAll = async () => {
    if (!user) return;
    const rows: any[] = [];
    for (const [uid, marksData] of Object.entries(grid)) {
      for (const [mid, val] of Object.entries(marksData)) {
        if (!val) continue;
        const num = Number(val);
        rows.push({
          user_id: uid, mark_id: mid,
          valor_numerico: isNaN(num) ? null : num,
          valor_texto: isNaN(num) ? val : null,
          origen: "masivo" as const, registrado_por: user.id,
          observaciones: testLabel,
        });
      }
    }
    if (!rows.length) return toast.error("Nada que guardar");
    const { error } = await supabase.from("mark_records").insert(rows);
    if (error) return toast.error(error.message);
    await supabase.from("bulk_imports").insert({ coach_id: user.id, nombre: testLabel, test_label: testLabel, data: { rows } as any });
    toast.success(`${rows.length} registros guardados`);
    setGrid({});
  };

  return (
    <div>
      <PageHeader title="Carga masiva" description="Tabla tipo Excel para introducir marcas de muchos usuarios. Cada deportista sólo verá sus propios datos." />
      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuración</TabsTrigger>
          <TabsTrigger value="grid">Grid de captura</TabsTrigger>
          <TabsTrigger value="metrics">Métricas calculadas</TabsTrigger>
          <TabsTrigger value="ref">Referencia</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>1. Etiqueta del test</CardTitle></CardHeader>
            <CardContent>
              <Label>Nombre del test / fecha</Label>
              <Input value={testLabel} onChange={(e) => setTestLabel(e.target.value)} className="max-w-xs mt-1" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>2. Selecciona usuarios</CardTitle><CardDescription>(vacío = todos)</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {profiles.map(p => (
                <label key={p.user_id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selectedUsers.has(p.user_id)} onChange={(e) => {
                    const s = new Set(selectedUsers);
                    e.target.checked ? s.add(p.user_id) : s.delete(p.user_id);
                    setSelectedUsers(s);
                  }} />
                  {p.nombre} {p.apellidos}
                </label>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>3. Selecciona marcas/pruebas</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {marks.map(m => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selectedMarks.has(m.id)} onChange={(e) => {
                    const s = new Set(selectedMarks);
                    e.target.checked ? s.add(m.id) : s.delete(m.id);
                    setSelectedMarks(s);
                  }} />
                  {m.nombre} <span className="text-xs text-muted-foreground">({m.unidad})</span>
                </label>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grid">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Grid · {testLabel}</CardTitle>
                <Button onClick={saveAll}><Save className="mr-2 h-4 w-4" /> Guardar todo</Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {marcasVisibles.length === 0 ? (
                <p className="text-muted-foreground text-sm">Selecciona al menos una marca en la pestaña Configuración.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card">Usuario</TableHead>
                      {marcasVisibles.map(m => <TableHead key={m.id}>{m.nombre}<br /><span className="text-[10px] font-normal">({m.unidad})</span></TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usuariosVisibles.map(p => (
                      <TableRow key={p.user_id}>
                        <TableCell className="font-medium sticky left-0 bg-card">{p.nombre} {p.apellidos}</TableCell>
                        {marcasVisibles.map(m => (
                          <TableCell key={m.id}>
                            <Input className="w-24 h-8" value={grid[p.user_id]?.[m.id] ?? ""} onChange={(e) => setCell(p.user_id, m.id, e.target.value)} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" /> Métricas automáticas</CardTitle>
              <CardDescription>Calculadas a partir del 1000m introducido en el grid.</CardDescription></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>VAM (km/h)</TableHead><TableHead>VO2max</TableHead><TableHead>Ritmo (min/km)</TableHead></TableRow></TableHeader>
                <TableBody>
                  {usuariosVisibles.map(p => {
                    const c = compute(grid[p.user_id] ?? {});
                    return (
                      <TableRow key={p.user_id}>
                        <TableCell>{p.nombre} {p.apellidos}</TableCell>
                        <TableCell>{c?.vam ?? "—"}</TableCell>
                        <TableCell>{c?.vo2 ?? "—"}</TableCell>
                        <TableCell>{c?.ritmo ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ref">
          <Card>
            <CardHeader><CardTitle>Guía de referencia</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <p><strong>VAM (Velocidad Aeróbica Máxima):</strong> velocidad mínima a la que se alcanza el VO2max. Aproximada como (distancia/tiempo)·3,6 a partir del 1000m.</p>
              <p><strong>VO2max:</strong> consumo máximo de oxígeno. Aproximación: VAM · 3,5.</p>
              <p><strong>Ritmo:</strong> minutos por kilómetro a la velocidad del test.</p>
              <p className="text-muted-foreground text-xs pt-2">Estas estimaciones son orientativas; usa pruebas específicas para cálculos precisos.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
