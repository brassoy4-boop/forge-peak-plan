import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Pencil, Trash2, Users, ChevronDown, ChevronRight, ArrowUp, ArrowDown,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  calcularDerivados, nivelColor, recuperacionLabel,
  FASES, type CooperFase, type Sexo,
} from "@/lib/cooper";
import { MetricsChart } from "@/components/MetricsChart";

interface CooperTest {
  id: string; nombre: string; fecha: string; temperatura: number | null;
  condiciones: string | null; notas: string | null; created_by: string;
  fase: CooperFase;
}
interface CooperResult {
  id: string; test_id: string; user_id: string; sexo: Sexo;
  fecha_nacimiento: string | null; cuerpo: string | null; peso: number | null;
  distancia_m: number; fc_final: number | null; fc_60s: number | null;
  fc_meta: number | null;
  tiempo_bajo_100_seg: number | null; observaciones: string | null;
}
interface ProfileLite {
  user_id: string; nombre: string; apellidos: string;
  sexo: Sexo | null; fecha_nacimiento: string | null; peso: number | null;
  oposicion: string | null;
}

const emptyTest = {
  nombre: "", fecha: new Date().toISOString().slice(0, 10),
  temperatura: "", condiciones: "", notas: "", fase: "inicial" as CooperFase,
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
  const [activeTab, setActiveTab] = useState<string>("inicial");
  const { user } = useAuth();

  const load = async () => {
    const [t, p, uo] = await Promise.all([
      supabase.from("cooper_tests").select("*").order("fecha", { ascending: false }),
      supabase.from("profiles").select("user_id, nombre, apellidos, sexo, fecha_nacimiento, peso").order("nombre"),
      supabase.from("user_oposiciones").select("user_id, oposiciones(nombre)"),
    ]);
    const oposByUser: Record<string, string> = {};
    (uo.data ?? []).forEach((r: any) => {
      if (!oposByUser[r.user_id] && r.oposiciones?.nombre) oposByUser[r.user_id] = r.oposiciones.nombre;
    });
    setUsers((p.data ?? []).map((u: any) => ({
      user_id: u.user_id, nombre: u.nombre, apellidos: u.apellidos,
      sexo: u.sexo, fecha_nacimiento: u.fecha_nacimiento, peso: u.peso,
      oposicion: oposByUser[u.user_id] ?? null,
    })));
    setTests((t.data ?? []) as CooperTest[]);
    if (t.data && t.data.length) {
      const ids = t.data.map((x: any) => x.id);
      const { data: r } = await supabase.from("cooper_results").select("*").in("test_id", ids);
      const grouped: Record<string, CooperResult[]> = {};
      (r ?? []).forEach((x: any) => { (grouped[x.test_id] ||= []).push(x as CooperResult); });
      setResults(grouped);
    } else {
      setResults({});
    }
  };
  useEffect(() => { load(); }, []);

  const profileOf = (id: string) => users.find((p) => p.user_id === id);

  const openNewTest = (fase: CooperFase) => {
    setEditingTest(null);
    setTestForm({ ...emptyTest, fase });
    setOpenTest(true);
  };
  const openEditTest = (t: CooperTest) => {
    setEditingTest(t);
    setTestForm({
      nombre: t.nombre, fecha: t.fecha,
      temperatura: t.temperatura?.toString() ?? "",
      condiciones: t.condiciones ?? "", notas: t.notas ?? "",
      fase: t.fase ?? "inicial",
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
      fase: testForm.fase,
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

  // Crea una fila vacía para un usuario en un test (selector inline)
  const addParticipant = async (test: CooperTest, userId: string) => {
    const prof = profileOf(userId);
    if (!prof) return;
    const exists = (results[test.id] ?? []).some((r) => r.user_id === userId);
    if (exists) return toast.error("Ese usuario ya está en el test");
    const payload = {
      test_id: test.id, user_id: userId,
      sexo: (prof.sexo ?? "masculino") as Sexo,
      fecha_nacimiento: prof.fecha_nacimiento,
      cuerpo: prof.oposicion,
      peso: prof.peso,
      distancia_m: 0,
    };
    const { error } = await supabase.from("cooper_results").insert(payload);
    if (error) return toast.error(error.message);
    load();
  };

  const updateResult = async (id: string, patch: Partial<CooperResult>) => {
    const { error } = await supabase.from("cooper_results").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    // optimista
    setResults((prev) => {
      const out: typeof prev = {};
      for (const [k, v] of Object.entries(prev)) {
        out[k] = v.map((r) => (r.id === id ? { ...r, ...patch } as CooperResult : r));
      }
      return out;
    });
  };
  const deleteResult = async (id: string) => {
    const { error } = await supabase.from("cooper_results").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Resultado eliminado"); load();
  };

  const testsByFase = useMemo(() => {
    const m: Record<CooperFase, CooperTest[]> = { inicial: [], mesociclo_1: [], mesociclo_2: [], pre_examen: [] };
    tests.forEach((t) => { m[t.fase ?? "inicial"].push(t); });
    return m;
  }, [tests]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Test de Cooper"
        description="Réplica del Excel: 4 fases, registro multiusuario y cálculo automático de VAM, VO2max, ritmos y recuperación."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto">
          {FASES.map((f) => (
            <TabsTrigger key={f.id} value={f.id}>{f.label}</TabsTrigger>
          ))}
          <TabsTrigger value="comparativa">Comparativa</TabsTrigger>
          <TabsTrigger value="referencia">Referencia</TabsTrigger>
        </TabsList>

        {FASES.map((f) => (
          <TabsContent key={f.id} value={f.id} className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => openNewTest(f.id)}>
                <Plus className="h-4 w-4 mr-1" />Nuevo test ({f.short})
              </Button>
            </div>
            {testsByFase[f.id].length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground">
                No hay tests en esta fase. Crea el primero.
              </CardContent></Card>
            )}
            {testsByFase[f.id].map((t) => (
              <TestCard
                key={t.id}
                test={t}
                results={results[t.id] ?? []}
                users={users}
                onEditTest={() => openEditTest(t)}
                onDeleteTest={() => deleteTest(t.id)}
                onAddParticipant={(uid) => addParticipant(t, uid)}
                onUpdateResult={updateResult}
                onDeleteResult={deleteResult}
              />
            ))}
          </TabsContent>
        ))}

        <TabsContent value="comparativa">
          <Comparativa tests={tests} results={results} users={users} />
        </TabsContent>

        <TabsContent value="referencia">
          <Referencia />
        </TabsContent>
      </Tabs>

      {/* Test dialog */}
      <Dialog open={openTest} onOpenChange={setOpenTest}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTest ? "Editar test" : "Nuevo test"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Fase</Label>
              <Select value={testForm.fase} onValueChange={(v) => setTestForm({ ...testForm, fase: v as CooperFase })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FASES.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nombre</Label>
              <Input value={testForm.nombre} onChange={(e) => setTestForm({ ...testForm, nombre: e.target.value })} placeholder="Ej. Promoción 2026 — Inicial" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Fecha</Label><Input type="date" value={testForm.fecha} onChange={(e) => setTestForm({ ...testForm, fecha: e.target.value })} /></div>
              <div><Label>Temperatura (°C)</Label><Input type="number" step="0.1" value={testForm.temperatura} onChange={(e) => setTestForm({ ...testForm, temperatura: e.target.value })} /></div>
            </div>
            <div><Label>Condiciones</Label><Input value={testForm.condiciones} onChange={(e) => setTestForm({ ...testForm, condiciones: e.target.value })} placeholder="Pista, viento, etc." /></div>
            <div><Label>Notas</Label><Textarea value={testForm.notas} onChange={(e) => setTestForm({ ...testForm, notas: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={saveTest}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============== TEST CARD (tabla editable inline tipo Excel) ============== */
function TestCard({
  test, results, users, onEditTest, onDeleteTest, onAddParticipant, onUpdateResult, onDeleteResult,
}: {
  test: CooperTest;
  results: CooperResult[];
  users: ProfileLite[];
  onEditTest: () => void;
  onDeleteTest: () => void;
  onAddParticipant: (userId: string) => void;
  onUpdateResult: (id: string, patch: Partial<CooperResult>) => void;
  onDeleteResult: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [newUserId, setNewUserId] = useState("");
  const userMap = useMemo(() => Object.fromEntries(users.map((u) => [u.user_id, u])), [users]);
  const availableUsers = users.filter((u) => !results.some((r) => r.user_id === u.user_id));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <button onClick={() => setOpen(!open)} className="flex items-start gap-2 text-left">
            {open ? <ChevronDown className="h-4 w-4 mt-1" /> : <ChevronRight className="h-4 w-4 mt-1" />}
            <div>
              <CardTitle className="flex items-center gap-2 flex-wrap">
                {test.nombre}
                <Badge variant="outline">{new Date(test.fecha).toLocaleDateString("es-ES")}</Badge>
                {test.temperatura != null && <Badge variant="outline">{test.temperatura}°C</Badge>}
                <Badge variant="secondary"><Users className="h-3 w-3 mr-1" />{results.length}</Badge>
              </CardTitle>
              {(test.condiciones || test.notas) && (
                <p className="text-sm text-muted-foreground mt-1">
                  {test.condiciones}{test.condiciones && test.notas ? " · " : ""}{test.notas}
                </p>
              )}
            </div>
          </button>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onEditTest}><Pencil className="h-4 w-4" /></Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar este test?</AlertDialogTitle>
                  <AlertDialogDescription>Se eliminarán todos los resultados asociados.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onDeleteTest}>Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          <p className="md:hidden text-xs text-muted-foreground mb-2">Desliza horizontalmente para ver todos los datos →</p>
          <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  {/* Identificación — gris oscuro */}
                  <TableHead className="w-10 bg-neutral-700 text-white text-center">Nº</TableHead>
                  <TableHead className="min-w-[180px] bg-neutral-700 text-white text-center">NOMBRE</TableHead>
                  {/* Datos personales — naranja claro */}
                  <TableHead className="bg-orange-200 text-neutral-900 text-center">SEXO</TableHead>
                  <TableHead className="min-w-[140px] bg-orange-200 text-neutral-900 text-center">F. NACIMIENTO</TableHead>
                  <TableHead className="bg-orange-200 text-neutral-900 text-center">EDAD</TableHead>
                  <TableHead className="min-w-[120px] bg-orange-200 text-neutral-900 text-center">CUERPO</TableHead>
                  <TableHead className="bg-orange-200 text-neutral-900 text-center">PESO (kg)</TableHead>
                  {/* Resultado y VO2 — azul */}
                  <TableHead className="bg-blue-300 text-neutral-900 text-center">DISTANCIA (m)</TableHead>
                  <TableHead className="bg-blue-300 text-neutral-900 text-center">VAM (km/h)</TableHead>
                  <TableHead className="bg-blue-300 text-neutral-900 text-center">VO2max (ml/kg/min)</TableHead>
                  <TableHead className="bg-blue-300 text-neutral-900 text-center">VO2max AJUSTADO SEXO</TableHead>
                  <TableHead className="bg-blue-300 text-neutral-900 text-center">NIVEL (edad + sexo)</TableHead>
                  {/* R-Umbral — naranja */}
                  <TableHead className="bg-orange-300 text-neutral-900 text-center">R-UMBRAL (min/km)</TableHead>
                  <TableHead className="bg-orange-300 text-neutral-900 text-center">R-UMBRAL (seg/400 m)</TableHead>
                  {/* Billat — verde */}
                  <TableHead className="bg-green-300 text-neutral-900 text-center">BILLAT (min/km)</TableHead>
                  <TableHead className="bg-green-300 text-neutral-900 text-center">BILLAT (seg/400 m)</TableHead>
                  {/* Zona 1 — azul claro */}
                  <TableHead className="bg-sky-200 text-neutral-900 text-center">ZONA 1 (min/km)</TableHead>
                  <TableHead className="bg-sky-200 text-neutral-900 text-center">ZONA 1 (seg/400 m)</TableHead>
                  {/* FC y recuperación — rojo claro */}
                  <TableHead className="bg-red-200 text-neutral-900 text-center">FC Meta</TableHead>
                  <TableHead className="bg-red-200 text-neutral-900 text-center">FC 60s</TableHead>
                  <TableHead className="bg-red-200 text-neutral-900 text-center">t&lt;100 lpm (s)</TableHead>
                  <TableHead className="bg-red-200 text-neutral-900 text-center">HRR (Recup.)</TableHead>
                  {/* Observaciones — gris */}
                  <TableHead className="min-w-[160px] bg-neutral-200 text-neutral-900 text-center">OBSERVACIONES</TableHead>
                  <TableHead className="bg-neutral-200"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r, i) => (
                  <ParticipantRow
                    key={r.id}
                    n={i + 1}
                    test={test}
                    r={r}
                    profile={userMap[r.user_id]}
                    onUpdate={(patch) => onUpdateResult(r.id, patch)}
                    onDelete={() => onDeleteResult(r.id)}
                  />
                ))}
                {results.length === 0 && (
                  <TableRow><TableCell colSpan={24} className="text-center text-muted-foreground py-4">
                    Sin participantes. Añade uno abajo.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex gap-2 items-end">
            <div className="flex-1 max-w-sm">
              <Label className="text-xs">Añadir participante</Label>
              <Select value={newUserId} onValueChange={setNewUserId}>
                <SelectTrigger><SelectValue placeholder="Selecciona usuario..." /></SelectTrigger>
                <SelectContent>
                  {availableUsers.length === 0 && <div className="px-2 py-1 text-sm text-muted-foreground">No hay usuarios disponibles</div>}
                  {availableUsers.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>{u.nombre} {u.apellidos}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              disabled={!newUserId}
              onClick={() => { onAddParticipant(newUserId); setNewUserId(""); }}
            >
              <Plus className="h-4 w-4 mr-1" />Añadir
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/* ============== Fila editable ============== */
function ParticipantRow({
  n, test, r, profile, onUpdate, onDelete,
}: {
  n: number;
  test: CooperTest;
  r: CooperResult;
  profile?: ProfileLite;
  onUpdate: (patch: Partial<CooperResult>) => void;
  onDelete: () => void;
}) {
  const d = useMemo(() => calcularDerivados({
    fechaNacimiento: r.fecha_nacimiento,
    fechaTest: test.fecha,
    sexo: r.sexo,
    distanciaM: r.distancia_m,
    tiempoBajo100: r.tiempo_bajo_100_seg,
  }), [r, test.fecha]);

  return (
    <TableRow>
      <TableCell className="text-xs text-muted-foreground">{n}</TableCell>
      <TableCell className="text-sm font-medium">
        {profile ? `${profile.nombre} ${profile.apellidos}` : "—"}
      </TableCell>
      <TableCell>
        <Select value={r.sexo} onValueChange={(v) => onUpdate({ sexo: v as Sexo })}>
          <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="masculino">H</SelectItem>
            <SelectItem value="femenino">M</SelectItem>
            <SelectItem value="unisex">—</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <CellInput type="date" value={r.fecha_nacimiento ?? ""} onCommit={(v) => onUpdate({ fecha_nacimiento: v || null })} className="w-[140px]" />
      </TableCell>
      <TableCell className="text-sm">{d.edad ?? "—"}</TableCell>
      <TableCell>
        <CellInput value={r.cuerpo ?? ""} onCommit={(v) => onUpdate({ cuerpo: v || null })} className="w-[120px]" />
      </TableCell>
      <TableCell>
        <CellInput type="number" step="0.1" value={r.peso?.toString() ?? ""} onCommit={(v) => onUpdate({ peso: v ? Number(v) : null })} className="w-20" />
      </TableCell>
      <TableCell>
        <CellInput type="number" value={r.distancia_m ? r.distancia_m.toString() : ""} onCommit={(v) => onUpdate({ distancia_m: v ? Number(v) : 0 })} className="w-24" />
      </TableCell>
      <TableCell className="text-sm text-center">{d.vam ?? "—"}</TableCell>
      <TableCell className="text-sm text-center">{d.vo2max ?? "—"}</TableCell>
      <TableCell className="text-sm text-center">{d.vo2maxAjustado ?? "—"}</TableCell>
      <TableCell className="text-center">{d.nivel && <Badge variant="outline" className={nivelColor(d.nivel)}>{d.nivel}</Badge>}</TableCell>
      <TableCell className="text-xs whitespace-nowrap text-center">{d.ritmos ? d.ritmos.rUmbral.minPorKm : "—"}</TableCell>
      <TableCell className="text-xs whitespace-nowrap text-center">{d.ritmos ? d.ritmos.rUmbral.segPor400 : "—"}</TableCell>
      <TableCell className="text-xs whitespace-nowrap text-center">{d.ritmos ? d.ritmos.billat.minPorKm : "—"}</TableCell>
      <TableCell className="text-xs whitespace-nowrap text-center">{d.ritmos ? d.ritmos.billat.segPor400 : "—"}</TableCell>
      <TableCell className="text-xs whitespace-nowrap text-center">{d.ritmos ? d.ritmos.zona1.minPorKm : "—"}</TableCell>
      <TableCell className="text-xs whitespace-nowrap text-center">{d.ritmos ? d.ritmos.zona1.segPor400 : "—"}</TableCell>
      <TableCell>
        <CellInput type="number" value={r.fc_meta?.toString() ?? ""} onCommit={(v) => onUpdate({ fc_meta: v ? Number(v) : null })} className="w-16" />
      </TableCell>
      <TableCell>
        <CellInput type="number" value={r.fc_60s?.toString() ?? ""} onCommit={(v) => onUpdate({ fc_60s: v ? Number(v) : null })} className="w-16" />
      </TableCell>
      <TableCell>
        <CellInput type="number" value={r.tiempo_bajo_100_seg?.toString() ?? ""} onCommit={(v) => onUpdate({ tiempo_bajo_100_seg: v ? Number(v) : null })} className="w-16" />
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap text-center">{recuperacionLabel(d.recuperacion)}</TableCell>
      <TableCell>
        <CellInput value={r.observaciones ?? ""} onCommit={(v) => onUpdate({ observaciones: v || null })} className="w-40" />
      </TableCell>
      <TableCell>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost"><Trash2 className="h-3 w-3 text-destructive" /></Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar participante?</AlertDialogTitle>
              <AlertDialogDescription>Se borrará su resultado en este test.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}

/* Input que solo guarda en blur o Enter */
function CellInput({
  value, onCommit, type = "text", step, className,
}: {
  value: string;
  onCommit: (v: string) => void;
  type?: string;
  step?: string;
  className?: string;
}) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <Input
      type={type}
      step={step}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== value) onCommit(v); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setV(value);
      }}
      className={`h-8 ${className ?? ""}`}
    />
  );
}

/* ============== COMPARATIVA ============== */
function Comparativa({
  tests, results, users,
}: {
  tests: CooperTest[];
  results: Record<string, CooperResult[]>;
  users: ProfileLite[];
}) {
  const rows = useMemo(() => {
    // Index: testId -> test
    const testById: Record<string, CooperTest> = Object.fromEntries(tests.map((t) => [t.id, t]));

    // Aplanar todos los resultados con su test
    const all: { r: CooperResult; t: CooperTest }[] = [];
    Object.values(results).forEach((arr) => arr.forEach((r) => {
      const t = testById[r.test_id];
      if (t) all.push({ r, t });
    }));

    // Agrupar por usuario
    const byUser: Record<string, { r: CooperResult; t: CooperTest }[]> = {};
    all.forEach((x) => { (byUser[x.r.user_id] ||= []).push(x); });

    return Object.entries(byUser).map(([uid, items]) => {
      const prof = users.find((u) => u.user_id === uid);
      const byFase: Record<CooperFase, { r: CooperResult; t: CooperTest } | null> = {
        inicial: null, mesociclo_1: null, mesociclo_2: null, pre_examen: null,
      };
      items.forEach((x) => {
        const f = x.t.fase ?? "inicial";
        if (!byFase[f] || byFase[f]!.t.fecha < x.t.fecha) byFase[f] = x;
      });
      const vamOf = (x: { r: CooperResult; t: CooperTest } | null) =>
        x ? calcularDerivados({
          fechaNacimiento: x.r.fecha_nacimiento, fechaTest: x.t.fecha, sexo: x.r.sexo,
          distanciaM: x.r.distancia_m, tiempoBajo100: null,
        }).vam : null;
      const vams = FASES.map((f) => vamOf(byFase[f.id]));
      const vamsValid = vams.filter((v): v is number => v != null && v > 0);
      const mejorVam = vamsValid.length ? Math.max(...vamsValid) : null;
      const t1Vam = vams[0];
      const lastVam = [...vams].reverse().find((v) => v != null && v > 0) ?? null;
      const evol = t1Vam && lastVam ? ((lastVam - t1Vam) / t1Vam) * 100 : null;
      const edad = calcularDerivados({
        fechaNacimiento: prof?.fecha_nacimiento ?? null,
        fechaTest: new Date().toISOString().slice(0, 10),
        sexo: (prof?.sexo ?? "masculino") as Sexo,
        distanciaM: 1,
        tiempoBajo100: null,
      }).edad;
      return { uid, prof, byFase, vams, mejorVam, evol, edad };
    }).sort((a, b) => (a.prof?.nombre ?? "").localeCompare(b.prof?.nombre ?? ""));
  }, [tests, results, users]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tabla comparativa de progresión</CardTitle>
        <p className="text-sm text-muted-foreground">Para cada usuario se muestra el último resultado de cada fase.</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="text-center text-muted-foreground py-6">Sin datos. Registra resultados en cualquiera de las fases.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>NOMBRE</TableHead>
                  <TableHead>SEXO</TableHead>
                  <TableHead>EDAD</TableHead>
                  <TableHead>CUERPO</TableHead>
                  {FASES.map((f) => (
                    <TableHead key={f.id} className="text-center">{f.short} Dist / VAM</TableHead>
                  ))}
                  <TableHead>MEJOR VAM</TableHead>
                  <TableHead>EVOLUCIÓN T1→últ.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={row.uid}>
                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{row.prof ? `${row.prof.nombre} ${row.prof.apellidos}` : "—"}</TableCell>
                    <TableCell className="text-xs">{row.prof?.sexo === "femenino" ? "M" : row.prof?.sexo === "masculino" ? "H" : "—"}</TableCell>
                    <TableCell>{row.edad ?? "—"}</TableCell>
                    <TableCell className="text-xs">{row.prof?.oposicion ?? "—"}</TableCell>
                    {FASES.map((f, idx) => {
                      const x = row.byFase[f.id];
                      return (
                        <TableCell key={f.id} className="text-xs text-center">
                          {x ? `${x.r.distancia_m} m / ${row.vams[idx]?.toFixed(2)}` : "—"}
                        </TableCell>
                      );
                    })}
                    <TableCell className="font-medium">{row.mejorVam?.toFixed(2) ?? "—"}</TableCell>
                    <TableCell>
                      {row.evol == null ? "—" : (
                        <span className={`flex items-center gap-1 text-sm ${row.evol >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {row.evol >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {Math.abs(row.evol).toFixed(1)}%
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ============== REFERENCIA (estática, ACSM 2021) ============== */
function Referencia() {
  const hombres = [
    ["EXCELENTE", "> 63", "> 60", "> 57", "> 54", "Top 5% — Élite"],
    ["MUY BUENO", "55 – 63", "53 – 60", "50 – 57", "47 – 54", "CNP notable / GC holgado"],
    ["BUENO", "48 – 54", "47 – 52", "43 – 49", "41 – 46", "CNP aprobado / Bombero base"],
    ["ACEPTABLE", "42 – 47", "40 – 46", "37 – 42", "35 – 40", "Límite CNP — trabajo urgente"],
    ["REGULAR", "35 – 41", "33 – 39", "31 – 36", "29 – 34", "Por debajo del aprobado"],
    ["BAJO", "< 35", "< 33", "< 31", "< 29", "Base crítica"],
  ];
  const mujeres = [
    ["EXCELENTE", "> 55", "> 52", "> 49", "> 47", "Top 5% — Élite"],
    ["MUY BUENO", "48 – 55", "46 – 52", "43 – 49", "41 – 47", "Nivel muy alto"],
    ["BUENO", "41 – 47", "39 – 45", "36 – 42", "34 – 40", "Nivel bueno"],
    ["ACEPTABLE", "35 – 40", "33 – 38", "30 – 35", "28 – 33", "Nivel aceptable"],
    ["REGULAR", "28 – 34", "26 – 32", "24 – 29", "22 – 27", "Por debajo de lo deseable"],
    ["BAJO", "< 28", "< 26", "< 24", "< 22", "Base crítica"],
  ];
  const formulas = [
    ["VAM (km/h)", "= Distancia (m) ÷ 200", "2.600m ÷ 200 = 13.0 km/h"],
    ["VO2max (H)", "= Dist × 0.0225 − 11.3", "2.600 × 0.0225 − 11.3 = 47.2"],
    ["VO2max (M)", "= Dist × 0.0200 − 7.5", "2.400 × 0.0200 − 7.5 = 40.5"],
    ["Billat 30-30", "= 1440 ÷ VAM → seg/400m", "VAM 13.0 → 111 seg/400m"],
    ["R-Umbral 85%", "= 1440 ÷ (VAM × 0.85) → s/400m", "VAM 13.0 → 130 seg/400m"],
    ["Zona 1 67%", "= 1440 ÷ (VAM × 0.67) → s/400m", "VAM 13.0 → 165 seg/400m"],
  ];

  const renderTabla = (titulo: string, filas: string[][]) => (
    <Card>
      <CardHeader><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>NIVEL</TableHead>
              <TableHead>&lt; 25 años</TableHead>
              <TableHead>25-34 años</TableHead>
              <TableHead>35-44 años</TableHead>
              <TableHead>&gt; 45 años</TableHead>
              <TableHead>Clasificación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((f) => (
              <TableRow key={f[0]}>
                <TableCell><Badge variant="outline" className={nivelColor(f[0] as any)}>{f[0]}</Badge></TableCell>
                <TableCell>{f[1]}</TableCell>
                <TableCell>{f[2]}</TableCell>
                <TableCell>{f[3]}</TableCell>
                <TableCell>{f[4]}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{f[5]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Tabla de referencia VO2max por edad y sexo — ACSM 2021</CardTitle>
        </CardHeader>
      </Card>
      {renderTabla("HOMBRES", hombres)}
      {renderTabla("MUJERES", mujeres)}
      <Card>
        <CardHeader><CardTitle className="text-base">Fórmulas rápidas</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicador</TableHead>
                <TableHead>Fórmula</TableHead>
                <TableHead>Ejemplo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formulas.map((f) => (
                <TableRow key={f[0]}>
                  <TableCell className="font-medium">{f[0]}</TableCell>
                  <TableCell className="font-mono text-xs">{f[1]}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{f[2]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-3">
            Fuente: ACSM Guidelines for Exercise Testing and Prescription (2021) · Hombres: VO2max = Dist × 0.0225 − 11.3 (Cooper 1968) · Mujeres: VO2max = Dist × 0.0200 − 7.5 (Heyward 2002).
          </p>
        </CardContent>
      </Card>
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
          fechaNacimiento: r.fecha_nacimiento, fechaTest: t.fecha, sexo: r.sexo,
          distanciaM: r.distancia_m, tiempoBajo100: r.tiempo_bajo_100_seg,
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
                <CardContent className="pt-6 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Test</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Fase</TableHead>
                        <TableHead>Dist (m)</TableHead>
                        <TableHead>VAM</TableHead>
                        <TableHead>VO2max</TableHead>
                        <TableHead>Nivel</TableHead>
                        <TableHead>R-Umbral</TableHead>
                        <TableHead>Billat</TableHead>
                        <TableHead>Zona 1</TableHead>
                        <TableHead>Recup.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enriched.map((e) => (
                        <TableRow key={e.r.id}>
                          <TableCell>{e.t.nombre}</TableCell>
                          <TableCell className="text-xs">{new Date(e.t.fecha).toLocaleDateString("es-ES")}</TableCell>
                          <TableCell className="text-xs">{FASES.find((f) => f.id === e.t.fase)?.short ?? "—"}</TableCell>
                          <TableCell className="font-medium">{e.r.distancia_m}</TableCell>
                          <TableCell>{e.d.vam ?? "—"}</TableCell>
                          <TableCell>{e.d.vo2max ?? "—"}</TableCell>
                          <TableCell>{e.d.nivel && <Badge variant="outline" className={nivelColor(e.d.nivel)}>{e.d.nivel}</Badge>}</TableCell>
                          <TableCell className="text-xs">{e.d.ritmos ? `${e.d.ritmos.rUmbral.minPorKm} · ${e.d.ritmos.rUmbral.segPor400}` : "—"}</TableCell>
                          <TableCell className="text-xs">{e.d.ritmos ? `${e.d.ritmos.billat.minPorKm} · ${e.d.ritmos.billat.segPor400}` : "—"}</TableCell>
                          <TableCell className="text-xs">{e.d.ritmos ? `${e.d.ritmos.zona1.minPorKm} · ${e.d.ritmos.zona1.segPor400}` : "—"}</TableCell>
                          <TableCell className="text-xs">{recuperacionLabel(e.d.recuperacion)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
