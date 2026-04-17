import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Save, Calculator, Loader2, FileSpreadsheet, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { isValidTime, isValidNumber } from "@/lib/validators";

/**
 * Carga masiva tipo Excel
 * - Selección de marcas y usuarios asignados
 * - Grid editable (filas = usuarios, columnas = marcas)
 * - Cálculos automáticos: VAM, VO2max, ritmos, recuperación cardíaca
 * - Guardado masivo en mark_records (cada usuario sólo verá sus filas por RLS)
 * - Comparativa entre dos imports previos
 */
export default function CargaMasiva() {
  const { user, primaryRole } = useAuth();
  const isSuper = primaryRole === "superadmin";
  const [profiles, setProfiles] = useState<any[]>([]);
  const [marks, setMarks] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedMarks, setSelectedMarks] = useState<Set<string>>(new Set());
  const [grid, setGrid] = useState<Record<string, Record<string, string>>>({});
  // Datos cardíacos para recuperación: FC al final + FC tras 1 minuto (no son marcas, sino columnas auxiliares)
  const [hr, setHr] = useState<Record<string, { final?: string; min1?: string }>>({});
  const [testLabel, setTestLabel] = useState("Test " + new Date().toLocaleDateString("es-ES"));
  const [saving, setSaving] = useState(false);
  const [imports, setImports] = useState<any[]>([]);
  const [cmpA, setCmpA] = useState<string>("");
  const [cmpB, setCmpB] = useState<string>("");

  const loadProfiles = async () => {
    if (!user) return;
    let q = supabase.from("profiles").select("user_id, nombre, apellidos");
    if (!isSuper) {
      // Solo usuarios asignados a este coach
      const { data: ca } = await supabase.from("coach_assignments").select("user_id").eq("coach_id", user.id);
      const ids = (ca ?? []).map(c => c.user_id);
      if (ids.length === 0) {
        setProfiles([]);
        return;
      }
      q = q.in("user_id", ids);
    }
    const { data } = await q.order("nombre");
    setProfiles(data ?? []);
  };

  const loadImports = async () => {
    const { data } = await supabase.from("bulk_imports").select("*").order("created_at", { ascending: false }).limit(20);
    setImports(data ?? []);
  };

  useEffect(() => {
    loadProfiles();
    loadImports();
    supabase.from("marks").select("*").eq("status", "activo").order("nombre").then(({ data }) => setMarks(data ?? []));
  }, [user, primaryRole]);

  const setCell = (userId: string, markId: string, value: string) => {
    setGrid(prev => ({ ...prev, [userId]: { ...(prev[userId] ?? {}), [markId]: value } }));
  };

  // Cálculos: VAM (km/h) desde 1000m (tiempo en seg), VO2max ≈ VAM * 3.5, ritmo (min/km), recuperación = HRfinal - HR1min
  const compute = (userId: string) => {
    const userRow = grid[userId] ?? {};
    const m1000 = marks.find(m => m.nombre.toLowerCase().includes("1000"));
    let vam: string | null = null, vo2: string | null = null, ritmo: string | null = null;
    if (m1000) {
      const t = Number(userRow[m1000.id]);
      if (t && t > 0) {
        const v = (1000 / t) * 3.6;
        vam = v.toFixed(2);
        vo2 = (v * 3.5).toFixed(1);
        ritmo = (t / 60).toFixed(2);
      }
    }
    const fcFinal = Number(hr[userId]?.final);
    const fcMin1 = Number(hr[userId]?.min1);
    const recup = fcFinal && fcMin1 ? (fcFinal - fcMin1).toString() : null;
    return { vam, vo2, ritmo, recup };
  };

  const usuariosVisibles = useMemo(
    () => profiles.filter(p => selectedUsers.size === 0 || selectedUsers.has(p.user_id)),
    [profiles, selectedUsers],
  );
  const marcasVisibles = useMemo(() => marks.filter(m => selectedMarks.has(m.id)), [marks, selectedMarks]);

  // Mejor VAM del grupo
  const mejorVam = useMemo(() => {
    let best: { name: string; vam: number } | null = null;
    usuariosVisibles.forEach(p => {
      const c = compute(p.user_id);
      if (c.vam) {
        const v = Number(c.vam);
        if (!best || v > best.vam) best = { name: `${p.nombre} ${p.apellidos}`, vam: v };
      }
    });
    return best;
  }, [usuariosVisibles, grid, hr, marks]);

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
    setSaving(true);
    const { error } = await supabase.from("mark_records").insert(rows);
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }
    // Snapshot del grid (incluye HR y métricas calculadas) para comparativas
    const snapshot = usuariosVisibles.map(p => ({
      user_id: p.user_id,
      nombre: `${p.nombre} ${p.apellidos}`,
      values: grid[p.user_id] ?? {},
      hr: hr[p.user_id] ?? {},
      metrics: compute(p.user_id),
    }));
    await supabase.from("bulk_imports").insert({
      coach_id: user.id, nombre: testLabel, test_label: testLabel,
      data: { rows, snapshot } as any,
    });
    setSaving(false);
    toast.success(`${rows.length} registros guardados`);
    setGrid({}); setHr({});
    loadImports();
  };

  // Comparativa
  const cmpData = useMemo(() => {
    const a = imports.find(i => i.id === cmpA);
    const b = imports.find(i => i.id === cmpB);
    if (!a || !b) return [];
    const aSnap: any[] = (a.data?.snapshot ?? []);
    const bSnap: any[] = (b.data?.snapshot ?? []);
    const map: Record<string, any> = {};
    aSnap.forEach((s: any) => { map[s.user_id] = { nombre: s.nombre, vamA: s.metrics?.vam, vamB: null }; });
    bSnap.forEach((s: any) => {
      map[s.user_id] = { nombre: s.nombre, vamA: map[s.user_id]?.vamA ?? null, vamB: s.metrics?.vam };
    });
    return Object.values(map);
  }, [imports, cmpA, cmpB]);

  return (
    <div>
      <PageHeader title="Carga masiva" description="Tabla tipo Excel para introducir marcas de muchos usuarios. Cada deportista sólo verá sus propios datos." />
      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuración</TabsTrigger>
          <TabsTrigger value="grid">Grid de captura</TabsTrigger>
          <TabsTrigger value="import">Importar Excel/CSV</TabsTrigger>
          <TabsTrigger value="metrics">Métricas calculadas</TabsTrigger>
          <TabsTrigger value="cmp">Comparativa</TabsTrigger>
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
            <CardHeader>
              <CardTitle>2. Selecciona usuarios</CardTitle>
              <CardDescription>(vacío = todos los visibles{!isSuper ? "; solo se muestran tus asignados" : ""})</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {profiles.length === 0 && <p className="text-sm text-muted-foreground col-span-full">No tienes usuarios asignados todavía.</p>}
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
                <Button onClick={saveAll} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Guardar todo
                </Button>
              </div>
              <CardDescription>Las columnas FC final y FC 1' permiten calcular la recuperación cardíaca.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {marcasVisibles.length === 0 || usuariosVisibles.length === 0 ? (
                <p className="text-muted-foreground text-sm">Selecciona al menos un usuario y una marca en la pestaña Configuración.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card">Usuario</TableHead>
                      {marcasVisibles.map(m => <TableHead key={m.id}>{m.nombre}<br /><span className="text-[10px] font-normal">({m.unidad})</span></TableHead>)}
                      <TableHead>FC final<br /><span className="text-[10px] font-normal">(ppm)</span></TableHead>
                      <TableHead>FC 1'<br /><span className="text-[10px] font-normal">(ppm)</span></TableHead>
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
                        <TableCell>
                          <Input className="w-20 h-8" value={hr[p.user_id]?.final ?? ""} onChange={(e) => setHr({ ...hr, [p.user_id]: { ...(hr[p.user_id] ?? {}), final: e.target.value } })} />
                        </TableCell>
                        <TableCell>
                          <Input className="w-20 h-8" value={hr[p.user_id]?.min1 ?? ""} onChange={(e) => setHr({ ...hr, [p.user_id]: { ...(hr[p.user_id] ?? {}), min1: e.target.value } })} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import">
          <ImportExcelPanel marks={marks} profiles={profiles} onImported={loadImports} testLabel={testLabel} userId={user?.id} />
        </TabsContent>

        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" /> Métricas automáticas</CardTitle>
              <CardDescription>
                Calculadas en vivo a partir del 1000m y la frecuencia cardíaca.
                {mejorVam && <span className="ml-2 text-primary font-medium">Mejor VAM: {mejorVam.vam.toFixed(2)} km/h ({mejorVam.name})</span>}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>VAM (km/h)</TableHead>
                    <TableHead>VO2max</TableHead>
                    <TableHead>Ritmo (min/km)</TableHead>
                    <TableHead>Recuperación cardíaca (ppm)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuariosVisibles.map(p => {
                    const c = compute(p.user_id);
                    return (
                      <TableRow key={p.user_id}>
                        <TableCell>{p.nombre} {p.apellidos}</TableCell>
                        <TableCell className="font-mono">{c.vam ?? "—"}</TableCell>
                        <TableCell className="font-mono">{c.vo2 ?? "—"}</TableCell>
                        <TableCell className="font-mono">{c.ritmo ?? "—"}</TableCell>
                        <TableCell className="font-mono">{c.recup ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cmp">
          <Card>
            <CardHeader>
              <CardTitle>Comparativa entre tests</CardTitle>
              <CardDescription>Compara VAM entre dos cargas guardadas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Test A</Label>
                  <Select value={cmpA} onValueChange={setCmpA}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{imports.map(i => <SelectItem key={i.id} value={i.id}>{i.nombre} · {new Date(i.created_at).toLocaleDateString("es-ES")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Test B</Label>
                  <Select value={cmpB} onValueChange={setCmpB}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{imports.map(i => <SelectItem key={i.id} value={i.id}>{i.nombre} · {new Date(i.created_at).toLocaleDateString("es-ES")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {cmpData.length > 0 && (
                <Table>
                  <TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>VAM A</TableHead><TableHead>VAM B</TableHead><TableHead>Δ</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {cmpData.map((row: any) => {
                      const a = Number(row.vamA), b = Number(row.vamB);
                      const delta = a && b ? (b - a).toFixed(2) : "—";
                      const cls = a && b ? (b > a ? "text-primary" : "text-muted-foreground") : "";
                      return (
                        <TableRow key={row.nombre}>
                          <TableCell>{row.nombre}</TableCell>
                          <TableCell className="font-mono">{row.vamA ?? "—"}</TableCell>
                          <TableCell className="font-mono">{row.vamB ?? "—"}</TableCell>
                          <TableCell className={`font-mono ${cls}`}>{delta}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
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
              <p><strong>Recuperación cardíaca:</strong> diferencia entre la FC al finalizar el esfuerzo y la FC tras 1 minuto de recuperación. Valores &gt; 30 ppm son indicativos de buena condición.</p>
              <p className="text-muted-foreground text-xs pt-2">Estas estimaciones son orientativas; usa pruebas específicas para cálculos precisos.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Importador Excel/CSV ----------
interface ImportProps {
  marks: any[];
  profiles: any[];
  testLabel: string;
  userId?: string;
  onImported: () => void;
}

interface RowError { row: number; col: string; reason: string; }

function ImportExcelPanel({ marks, profiles, testLabel, userId, onImported }: ImportProps) {
  const [parsed, setParsed] = useState<any[][]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [valid, setValid] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const downloadTemplate = () => {
    const headers = ["email", "nombre", ...marks.slice(0, 5).map((m) => m.nombre)];
    const example = ["deportista@correo.com", "Nombre Apellidos", ...marks.slice(0, 5).map((m) => m.value_type === "tiempo" ? "04:30.00" : "10")];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Marcas");
    XLSX.writeFile(wb, "plantilla_carga_masiva.xlsx");
  };

  const handleFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
    setParsed(rows);
    validate(rows);
  };

  const validate = (rows: any[][]) => {
    if (rows.length < 2) { setErrors([{ row: 0, col: "—", reason: "Archivo vacío o sin cabecera" }]); setValid([]); return; }
    const header = rows[0].map((h) => String(h).trim());
    const emailIdx = header.findIndex((h) => h.toLowerCase() === "email");
    if (emailIdx === -1) { setErrors([{ row: 1, col: "email", reason: "Falta la columna 'email'" }]); setValid([]); return; }
    // Mapear columnas a marcas
    const colToMark: Record<number, any> = {};
    header.forEach((h, idx) => {
      const m = marks.find((mk) => mk.nombre.toLowerCase() === h.toLowerCase());
      if (m) colToMark[idx] = m;
    });
    const errs: RowError[] = [];
    const ok: any[] = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every((c) => !c)) continue;
      const email = String(row[emailIdx] ?? "").trim().toLowerCase();
      if (!email) { errs.push({ row: r + 1, col: "email", reason: "Email vacío" }); continue; }
      const profile = profiles.find((p: any) => (p.email ?? "").toLowerCase() === email);
      if (!profile) { errs.push({ row: r + 1, col: "email", reason: `No existe deportista con email "${email}"` }); continue; }
      for (const [idxStr, mark] of Object.entries(colToMark)) {
        const idx = Number(idxStr);
        const raw = String(row[idx] ?? "").trim();
        if (!raw) continue;
        const tipo = mark.value_type;
        let valor_numerico: number | null = null;
        let valor_texto: string | null = null;
        if (tipo === "tiempo") {
          if (!isValidTime(raw)) { errs.push({ row: r + 1, col: header[idx], reason: `Tiempo inválido "${raw}" (usa mm:ss o mm:ss.cc)` }); continue; }
          const sec = Number(raw.includes(":") ? raw : raw.replace(",", "."));
          valor_numerico = sec; valor_texto = raw;
        } else if (["distancia", "repeticiones", "peso", "puntuacion"].includes(tipo)) {
          if (!isValidNumber(raw)) { errs.push({ row: r + 1, col: header[idx], reason: `Valor numérico inválido "${raw}"` }); continue; }
          valor_numerico = Number(raw.replace(",", "."));
        } else {
          valor_texto = raw;
        }
        ok.push({
          user_id: profile.user_id, mark_id: mark.id,
          valor_numerico, valor_texto,
          origen: "importacion" as const,
          registrado_por: userId,
          observaciones: testLabel,
        });
      }
    }
    setErrors(errs); setValid(ok);
  };

  const importAll = async () => {
    if (!valid.length) return toast.error("Nada válido que importar");
    setSaving(true);
    const { error } = await supabase.from("mark_records").insert(valid);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${valid.length} registros importados`);
    setParsed([]); setErrors([]); setValid([]);
    onImported();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" /> Importar desde Excel/CSV</CardTitle>
          <Button size="sm" variant="outline" onClick={downloadTemplate}><Download className="mr-2 h-3 w-3" /> Plantilla</Button>
        </div>
        <CardDescription>
          Cabecera obligatoria: <code>email</code>. Una columna por cada nombre exacto de marca activa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {parsed.length > 0 && (
          <div className="text-sm space-y-2">
            <p>Filas leídas: <strong>{parsed.length - 1}</strong> · Registros válidos: <strong className="text-primary">{valid.length}</strong> · Errores: <strong className="text-destructive">{errors.length}</strong></p>
            {errors.length > 0 && (
              <div className="border rounded max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Fila</TableHead><TableHead>Columna</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {errors.map((e, i) => (
                      <TableRow key={i}><TableCell>{e.row}</TableCell><TableCell>{e.col}</TableCell><TableCell className="text-destructive">{e.reason}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <Button onClick={importAll} disabled={saving || valid.length === 0}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Importar {valid.length} registros
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

