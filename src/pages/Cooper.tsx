import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Timer, Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { calcularDerivados, nivelColor, type Sexo } from "@/lib/cooper";
import { MetricsChart } from "@/components/MetricsChart";

interface CooperTest {
  id: string; nombre: string; fecha: string; temperatura: number | null;
  condiciones: string | null; notas: string | null; created_by: string;
}
interface CooperResult {
  id: string; test_id: string; user_id: string; sexo: Sexo;
  fecha_nacimiento: string | null; cuerpo: string | null; peso: number | null;
  distancia_m: number; fc_final: number | null; fc_60s: number | null;
  tiempo_bajo_100_seg: number | null; observaciones: string | null;
}
interface ProfileLite { user_id: string; nombre: string; apellidos: string; }

const emptyTest = { nombre: "", fecha: new Date().toISOString().slice(0, 10), temperatura: "", condiciones: "", notas: "" };
const emptyResult = {
  user_id: "", sexo: "masculino" as Sexo, fecha_nacimiento: "", cuerpo: "", peso: "",
  distancia_m: "", fc_final: "", fc_60s: "", tiempo_bajo_100_seg: "", observaciones: "",
};

export default function Cooper() {
  const { user, primaryRole } = useAuth();
  const isCoach = primaryRole === "entrenador" || primaryRole === "superadmin";

  if (isCoach) return <CooperAdmin />;
  return <CooperUser userId={user?.id ?? ""} />;
}

/* ============== ADMIN VIEW ============== */
function CooperAdmin() {
  const [tests, setTests] = useState<CooperTest[]>([]);
  const [results, setResults] = useState<Record<string, CooperResult[]>>({});
  const [users, setUsers] = useState<ProfileLite[]>([]);
  const [openTest, setOpenTest] = useState(false);
  const [editingTest, setEditingTest] = useState<CooperTest | null>(null);
  const [testForm, setTestForm] = useState(emptyTest);
  const [activeTest, setActiveTest] = useState<CooperTest | null>(null);
  const [openResult, setOpenResult] = useState(false);
  const [editingResult, setEditingResult] = useState<CooperResult | null>(null);
  const [resultForm, setResultForm] = useState(emptyResult);
  const { user } = useAuth();

  const load = async () => {
    const [t, u] = await Promise.all([
      supabase.from("cooper_tests").select("*").order("fecha", { ascending: false }),
      supabase.from("profiles").select("user_id, nombre, apellidos").order("nombre"),
    ]);
    setTests((t.data ?? []) as CooperTest[]);
    setUsers((u.data ?? []) as ProfileLite[]);
    if (t.data && t.data.length) {
      const ids = t.data.map((x: any) => x.id);
      const { data: r } = await supabase.from("cooper_results").select("*").in("test_id", ids);
      const grouped: Record<string, CooperResult[]> = {};
      (r ?? []).forEach((x: any) => { (grouped[x.test_id] ||= []).push(x as CooperResult); });
      setResults(grouped);
    }
  };
  useEffect(() => { load(); }, []);

  const profileOf = (id: string) => users.find((p) => p.user_id === id);

  const openNewTest = () => { setEditingTest(null); setTestForm(emptyTest); setOpenTest(true); };
  const openEditTest = (t: CooperTest) => {
    setEditingTest(t);
    setTestForm({
      nombre: t.nombre, fecha: t.fecha,
      temperatura: t.temperatura?.toString() ?? "",
      condiciones: t.condiciones ?? "", notas: t.notas ?? "",
    });
    setOpenTest(true);
  };
  const saveTest = async () => {
    if (!testForm.nombre.trim() || !testForm.fecha) return toast.error("Nombre y fecha obligatorios");
    const payload = {
      nombre: testForm.nombre.trim(),
      fecha: testForm.fecha,
      temperatura: testForm.temperatura ? Number(testForm.temperatura) : null,
      condiciones: testForm.condiciones.trim() || null,
      notas: testForm.notas.trim() || null,
      created_by: user!.id,
    };
    const { error } = editingTest
      ? await supabase.from("cooper_tests").update(payload).eq("id", editingTest.id)
      : await supabase.from("cooper_tests").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editingTest ? "Test actualizado" : "Test creado");
    setOpenTest(false); load();
  };
  const deleteTest = async (id: string) => {
    const { error } = await supabase.from("cooper_tests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Test eliminado"); load();
  };

  const openNewResult = (t: CooperTest) => {
    setActiveTest(t); setEditingResult(null); setResultForm(emptyResult); setOpenResult(true);
  };
  const openEditResult = (t: CooperTest, r: CooperResult) => {
    setActiveTest(t); setEditingResult(r);
    setResultForm({
      user_id: r.user_id, sexo: r.sexo,
      fecha_nacimiento: r.fecha_nacimiento ?? "",
      cuerpo: r.cuerpo ?? "", peso: r.peso?.toString() ?? "",
      distancia_m: r.distancia_m.toString(),
      fc_final: r.fc_final?.toString() ?? "",
      fc_60s: r.fc_60s?.toString() ?? "",
      tiempo_bajo_100_seg: r.tiempo_bajo_100_seg?.toString() ?? "",
      observaciones: r.observaciones ?? "",
    });
    setOpenResult(true);
  };
  const saveResult = async () => {
    if (!activeTest) return;
    if (!resultForm.user_id) return toast.error("Selecciona un usuario");
    if (!resultForm.distancia_m || Number(resultForm.distancia_m) <= 0) return toast.error("Distancia obligatoria");
    const payload = {
      test_id: activeTest.id,
      user_id: resultForm.user_id,
      sexo: resultForm.sexo,
      fecha_nacimiento: resultForm.fecha_nacimiento || null,
      cuerpo: resultForm.cuerpo.trim() || null,
      peso: resultForm.peso ? Number(resultForm.peso) : null,
      distancia_m: Number(resultForm.distancia_m),
      fc_final: resultForm.fc_final ? Number(resultForm.fc_final) : null,
      fc_60s: resultForm.fc_60s ? Number(resultForm.fc_60s) : null,
      tiempo_bajo_100_seg: resultForm.tiempo_bajo_100_seg ? Number(resultForm.tiempo_bajo_100_seg) : null,
      observaciones: resultForm.observaciones.trim() || null,
    };
    const { error } = editingResult
      ? await supabase.from("cooper_results").update(payload).eq("id", editingResult.id)
      : await supabase.from("cooper_results").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Resultado guardado");
    setOpenResult(false); load();
  };
  const deleteResult = async (id: string) => {
    const { error } = await supabase.from("cooper_results").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Resultado eliminado"); load();
  };

  // Live preview de derivados en el formulario
  const previewDerivados = useMemo(() => {
    if (!activeTest || !resultForm.distancia_m) return null;
    return calcularDerivados({
      fechaNacimiento: resultForm.fecha_nacimiento || null,
      fechaTest: activeTest.fecha,
      sexo: resultForm.sexo,
      distanciaM: Number(resultForm.distancia_m),
      tiempoBajo100: resultForm.tiempo_bajo_100_seg ? Number(resultForm.tiempo_bajo_100_seg) : null,
    });
  }, [activeTest, resultForm]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Test de Cooper"
        description="Gestión de jornadas, registro de marcas y cálculo automático de indicadores."
        actions={<Button onClick={openNewTest}><Plus className="h-4 w-4 mr-1" />Nuevo test</Button>}
      />

      <div className="grid gap-4">
        {tests.length === 0 && (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No hay tests aún. Crea el primero.</CardContent></Card>
        )}
        {tests.map((t) => {
          const rs = results[t.id] ?? [];
          const stats = computeStats(rs);
          return (
            <Card key={t.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {t.nombre}
                      <Badge variant="outline">{new Date(t.fecha).toLocaleDateString("es-ES")}</Badge>
                      {t.temperatura != null && <Badge variant="outline">{t.temperatura}°C</Badge>}
                      <Badge variant="secondary"><Users className="h-3 w-3 mr-1" />{rs.length}</Badge>
                    </CardTitle>
                    {(t.condiciones || t.notas) && (
                      <p className="text-sm text-muted-foreground mt-1">{t.condiciones}{t.condiciones && t.notas ? " · " : ""}{t.notas}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openNewResult(t)}><Plus className="h-4 w-4 mr-1" />Añadir resultado</Button>
                    <Button size="sm" variant="ghost" onClick={() => openEditTest(t)}><Pencil className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar este test?</AlertDialogTitle>
                          <AlertDialogDescription>Se eliminarán todos los resultados asociados. Esta acción no se puede deshacer.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteTest(t.id)}>Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {rs.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                    <StatCard label="Media distancia" value={`${stats.avgDist} m`} />
                    <StatCard label="Media VAM" value={`${stats.avgVam} km/h`} />
                    <StatCard label="Media VO2max" value={`${stats.avgVo2}`} />
                    <StatCard label="Máx distancia" value={`${stats.maxDist} m`} />
                    <StatCard label="Mín distancia" value={`${stats.minDist} m`} />
                  </div>
                )}
                <ResultsTable
                  testFecha={t.fecha}
                  results={rs}
                  profileOf={profileOf}
                  onEdit={(r) => openEditResult(t, r)}
                  onDelete={deleteResult}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Test dialog */}
      <Dialog open={openTest} onOpenChange={setOpenTest}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTest ? "Editar test" : "Nuevo test"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={testForm.nombre} onChange={(e) => setTestForm({ ...testForm, nombre: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Fecha</Label><Input type="date" value={testForm.fecha} onChange={(e) => setTestForm({ ...testForm, fecha: e.target.value })} /></div>
              <div><Label>Temperatura (°C)</Label><Input type="number" step="0.1" value={testForm.temperatura} onChange={(e) => setTestForm({ ...testForm, temperatura: e.target.value })} /></div>
            </div>
            <div><Label>Condiciones</Label><Input value={testForm.condiciones} onChange={(e) => setTestForm({ ...testForm, condiciones: e.target.value })} /></div>
            <div><Label>Notas</Label><Textarea value={testForm.notas} onChange={(e) => setTestForm({ ...testForm, notas: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={saveTest}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result dialog */}
      <Dialog open={openResult} onOpenChange={setOpenResult}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingResult ? "Editar resultado" : "Añadir resultado"} — {activeTest?.nombre}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Usuario</Label>
              <Select value={resultForm.user_id} onValueChange={(v) => setResultForm({ ...resultForm, user_id: v })} disabled={!!editingResult}>
                <SelectTrigger><SelectValue placeholder="Selecciona usuario" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.nombre} {u.apellidos}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sexo</Label>
                <Select value={resultForm.sexo} onValueChange={(v) => setResultForm({ ...resultForm, sexo: v as Sexo })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Hombre</SelectItem>
                    <SelectItem value="femenino">Mujer</SelectItem>
                    <SelectItem value="unisex">Unisex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Fecha de nacimiento</Label><Input type="date" value={resultForm.fecha_nacimiento} onChange={(e) => setResultForm({ ...resultForm, fecha_nacimiento: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cuerpo / perfil</Label><Input value={resultForm.cuerpo} onChange={(e) => setResultForm({ ...resultForm, cuerpo: e.target.value })} /></div>
              <div><Label>Peso (kg)</Label><Input type="number" step="0.1" value={resultForm.peso} onChange={(e) => setResultForm({ ...resultForm, peso: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Distancia (m) *</Label><Input type="number" value={resultForm.distancia_m} onChange={(e) => setResultForm({ ...resultForm, distancia_m: e.target.value })} /></div>
              <div><Label>FC final (ppm)</Label><Input type="number" value={resultForm.fc_final} onChange={(e) => setResultForm({ ...resultForm, fc_final: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>FC a los 60s</Label><Input type="number" value={resultForm.fc_60s} onChange={(e) => setResultForm({ ...resultForm, fc_60s: e.target.value })} /></div>
              <div><Label>Tiempo en bajar de 100 ppm (s)</Label><Input type="number" value={resultForm.tiempo_bajo_100_seg} onChange={(e) => setResultForm({ ...resultForm, tiempo_bajo_100_seg: e.target.value })} /></div>
            </div>
            <div><Label>Observaciones</Label><Textarea value={resultForm.observaciones} onChange={(e) => setResultForm({ ...resultForm, observaciones: e.target.value })} /></div>

            {previewDerivados && (
              <Card className="bg-muted/30">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Vista previa de cálculos</CardTitle></CardHeader>
                <CardContent className="text-sm grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div><span className="text-muted-foreground">Edad:</span> {previewDerivados.edad ?? "—"}</div>
                  <div><span className="text-muted-foreground">VAM:</span> {previewDerivados.vam ?? "—"} km/h</div>
                  <div><span className="text-muted-foreground">VO2max:</span> {previewDerivados.vo2max ?? "—"}</div>
                  <div><span className="text-muted-foreground">Nivel:</span> {previewDerivados.nivel ?? "—"}</div>
                  <div><span className="text-muted-foreground">Recuperación:</span> {previewDerivados.recuperacion ?? "—"}</div>
                  {previewDerivados.ritmos && (
                    <>
                      <div><span className="text-muted-foreground">R-Umbral:</span> {previewDerivados.ritmos.rUmbral.minPorKm}/km</div>
                      <div><span className="text-muted-foreground">Billat:</span> {previewDerivados.ritmos.billat.minPorKm}/km</div>
                      <div><span className="text-muted-foreground">Zona 1:</span> {previewDerivados.ritmos.zona1.minPorKm}/km</div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter><Button onClick={saveResult}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============== USER VIEW ============== */
function CooperUser({ userId }: { userId: string }) {
  const [results, setResults] = useState<CooperResult[]>([]);
  const [tests, setTests] = useState<Record<string, CooperTest>>({});

  const load = async () => {
    if (!userId) return;
    const { data: r } = await supabase.from("cooper_results").select("*").eq("user_id", userId);
    const rs = (r ?? []) as CooperResult[];
    if (rs.length) {
      const ids = Array.from(new Set(rs.map((x) => x.test_id)));
      const { data: t } = await supabase.from("cooper_tests").select("*").in("id", ids);
      const map: Record<string, CooperTest> = {};
      (t ?? []).forEach((x: any) => { map[x.id] = x as CooperTest; });
      setTests(map);
      rs.sort((a, b) => (tests[a.test_id]?.fecha ?? "").localeCompare(tests[b.test_id]?.fecha ?? ""));
    }
    setResults(rs);
  };
  useEffect(() => { load(); }, [userId]);

  const enriched = useMemo(() => {
    return results
      .map((r) => {
        const t = tests[r.test_id];
        if (!t) return null;
        const d = calcularDerivados({
          fechaNacimiento: r.fecha_nacimiento,
          fechaTest: t.fecha,
          sexo: r.sexo,
          distanciaM: r.distancia_m,
          tiempoBajo100: r.tiempo_bajo_100_seg,
        });
        return { r, t, d };
      })
      .filter(Boolean)
      .sort((a, b) => a!.t.fecha.localeCompare(b!.t.fecha)) as { r: CooperResult; t: CooperTest; d: ReturnType<typeof calcularDerivados> }[];
  }, [results, tests]);

  const kpis = useMemo(() => {
    if (enriched.length === 0) return null;
    const distancias = enriched.map((e) => e.r.distancia_m);
    const vams = enriched.map((e) => e.d.vam ?? 0);
    const first = enriched[0];
    const last = enriched[enriched.length - 1];
    return {
      mejorDistancia: Math.max(...distancias),
      mejorVam: Math.max(...vams).toFixed(2),
      first, last,
      deltaDist: last.r.distancia_m - first.r.distancia_m,
    };
  }, [enriched]);

  const chartDist = enriched.map((e) => ({ fecha: new Date(e.t.fecha).toLocaleDateString("es-ES"), valor: e.r.distancia_m }));
  const chartVo2 = enriched.map((e) => ({ fecha: new Date(e.t.fecha).toLocaleDateString("es-ES"), valor: e.d.vo2max ?? 0 }));

  return (
    <div className="space-y-6">
      <PageHeader title="Mis tests de Cooper" description="Tu histórico personal y evolución." />

      {enriched.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Aún no tienes resultados de Cooper registrados.</CardContent></Card>
      ) : (
        <>
          {kpis && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Mejor distancia" value={`${kpis.mejorDistancia} m`} />
              <StatCard label="Mejor VAM" value={`${kpis.mejorVam} km/h`} />
              <StatCard label="Tests" value={`${enriched.length}`} />
              <StatCard label="Δ primer→último" value={`${kpis.deltaDist > 0 ? "+" : ""}${kpis.deltaDist} m`} />
            </div>
          )}

          <Tabs defaultValue="historico">
            <TabsList>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
              <TabsTrigger value="evolucion">Evolución</TabsTrigger>
            </TabsList>
            <TabsContent value="historico">
              <Card>
                <CardContent className="pt-6">
                  <ResultsTable
                    testFecha=""
                    results={enriched.map((e) => e.r)}
                    testsMap={tests}
                    profileOf={() => undefined}
                    showUserCol={false}
                    showTestCol
                    onEdit={undefined}
                    onDelete={undefined}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="evolucion">
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Distancia (m)</CardTitle></CardHeader>
                  <CardContent><MetricsChart data={chartDist} label="distancia" /></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">VO2max</CardTitle></CardHeader>
                  <CardContent><MetricsChart data={chartVo2} label="vo2max" /></CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

/* ============== Shared subcomponents ============== */
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function ResultsTable({
  results, profileOf, onEdit, onDelete, testFecha, testsMap, showUserCol = true, showTestCol = false,
}: {
  results: CooperResult[];
  profileOf: (id: string) => ProfileLite | undefined;
  onEdit?: (r: CooperResult) => void;
  onDelete?: (id: string) => void;
  testFecha: string;
  testsMap?: Record<string, CooperTest>;
  showUserCol?: boolean;
  showTestCol?: boolean;
}) {
  if (results.length === 0) {
    return <div className="text-sm text-muted-foreground py-4 text-center">Sin resultados.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {showTestCol && <TableHead>Test</TableHead>}
            {showUserCol && <TableHead>Usuario</TableHead>}
            <TableHead>Sexo</TableHead>
            <TableHead>Edad</TableHead>
            <TableHead>Dist (m)</TableHead>
            <TableHead>VAM</TableHead>
            <TableHead>VO2max</TableHead>
            <TableHead>Nivel</TableHead>
            <TableHead>R-Umbral</TableHead>
            <TableHead>Billat</TableHead>
            <TableHead>Zona 1</TableHead>
            <TableHead>Recup.</TableHead>
            {(onEdit || onDelete) && <TableHead></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((r) => {
            const fechaRef = testsMap?.[r.test_id]?.fecha ?? testFecha;
            const d = calcularDerivados({
              fechaNacimiento: r.fecha_nacimiento, fechaTest: fechaRef, sexo: r.sexo,
              distanciaM: r.distancia_m, tiempoBajo100: r.tiempo_bajo_100_seg,
            });
            const prof = profileOf(r.user_id);
            return (
              <TableRow key={r.id}>
                {showTestCol && <TableCell className="text-xs">{testsMap?.[r.test_id]?.nombre} <div className="text-muted-foreground">{fechaRef && new Date(fechaRef).toLocaleDateString("es-ES")}</div></TableCell>}
                {showUserCol && <TableCell className="text-sm">{prof ? `${prof.nombre} ${prof.apellidos}` : "—"}</TableCell>}
                <TableCell className="text-xs capitalize">{r.sexo}</TableCell>
                <TableCell>{d.edad ?? "—"}</TableCell>
                <TableCell className="font-medium">{r.distancia_m}</TableCell>
                <TableCell>{d.vam ?? "—"}</TableCell>
                <TableCell>{d.vo2max ?? "—"}</TableCell>
                <TableCell>{d.nivel && <Badge variant="outline" className={nivelColor(d.nivel)}>{d.nivel}</Badge>}</TableCell>
                <TableCell className="text-xs">{d.ritmos ? `${d.ritmos.rUmbral.minPorKm}/km · ${d.ritmos.rUmbral.segPor400}/400` : "—"}</TableCell>
                <TableCell className="text-xs">{d.ritmos ? `${d.ritmos.billat.minPorKm}/km · ${d.ritmos.billat.segPor400}/400` : "—"}</TableCell>
                <TableCell className="text-xs">{d.ritmos ? `${d.ritmos.zona1.minPorKm}/km · ${d.ritmos.zona1.segPor400}/400` : "—"}</TableCell>
                <TableCell className="text-xs">{d.recuperacion ?? "—"}</TableCell>
                {(onEdit || onDelete) && (
                  <TableCell>
                    <div className="flex gap-1">
                      {onEdit && <Button size="sm" variant="ghost" onClick={() => onEdit(r)}><Pencil className="h-3 w-3" /></Button>}
                      {onDelete && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost"><Trash2 className="h-3 w-3 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar resultado?</AlertDialogTitle>
                              <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDelete(r.id)}>Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function computeStats(rs: CooperResult[]) {
  if (rs.length === 0) return { avgDist: 0, avgVam: 0, avgVo2: 0, maxDist: 0, minDist: 0 };
  const dists = rs.map((r) => r.distancia_m);
  const vams = rs.map((r) => r.distancia_m / 200);
  const vo2s = rs.map((r) => r.sexo === "femenino" ? r.distancia_m * 0.020 - 7.5 : r.distancia_m * 0.0225 - 11.3);
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  return {
    avgDist: Math.round(avg(dists)),
    avgVam: avg(vams).toFixed(2),
    avgVo2: avg(vo2s).toFixed(1),
    maxDist: Math.max(...dists),
    minDist: Math.min(...dists),
  };
}
