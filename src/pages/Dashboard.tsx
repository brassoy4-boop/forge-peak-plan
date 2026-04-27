import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Dumbbell, Activity, Users, Target, BookOpen, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { MetricsChart } from "@/components/MetricsChart";

export default function Dashboard() {
  const { primaryRole, user } = useAuth();
  const [stats, setStats] = useState<Record<string, number>>({});
  const [lastDiary, setLastDiary] = useState<any | null>(null);
  const [activeRoutines, setActiveRoutines] = useState<any[]>([]);

  // Datos para gráficas (rol usuario)
  const [diaryFields, setDiaryFields] = useState<any[]>([]);
  const [diaryValues, setDiaryValues] = useState<any[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string>("");
  const [marks, setMarks] = useState<any[]>([]);
  const [markRecords, setMarkRecords] = useState<any[]>([]);
  const [selectedMarkId, setSelectedMarkId] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      if (primaryRole === "usuario") {
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const sinceISO = since.toISOString().slice(0, 10);

        const [opos, rutinas, simulacros, marcasCount, diary30, ra, dfields, drecent, mrecords, allMarks] = await Promise.all([
          supabase.from("user_oposiciones").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("routine_assignments").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("activa", true),
          supabase.from("simulacro_executions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("mark_records").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("diary_entries").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("fecha", sinceISO),
          supabase.from("routine_assignments").select("*, routines(nombre, num_dias)").eq("user_id", user.id).eq("activa", true),
          supabase.from("diary_field_configs").select("*").eq("status", "activo").order("orden"),
          supabase.from("diary_entries").select("id, fecha").eq("user_id", user.id).gte("fecha", sinceISO).order("fecha"),
          supabase.from("mark_records").select("*").eq("user_id", user.id).order("fecha"),
          supabase.from("marks").select("id, nombre, value_type").eq("status", "activo").order("nombre"),
        ]);

        setStats({
          oposiciones: opos.count ?? 0,
          rutinas: rutinas.count ?? 0,
          simulacros: simulacros.count ?? 0,
          marcas: marcasCount.count ?? 0,
          diario30: diary30.count ?? 0,
        });
        setActiveRoutines(ra.data ?? []);
        setDiaryFields(dfields.data ?? []);
        if ((dfields.data ?? []).length && !selectedFieldId) {
          setSelectedFieldId(dfields.data![0].id);
        }
        setMarks(allMarks.data ?? []);
        setMarkRecords(mrecords.data ?? []);

        // Última entrada de diario detallada
        const { data: lastEntry } = await supabase
          .from("diary_entries")
          .select("fecha, descripcion, session_types(nombre)")
          .eq("user_id", user.id)
          .order("fecha", { ascending: false })
          .limit(1)
          .maybeSingle();
        setLastDiary(lastEntry);

        // Cargar valores de campos del diario para los IDs recientes
        const entryIds = (drecent.data ?? []).map((e: any) => e.id);
        if (entryIds.length) {
          const { data: vals } = await supabase
            .from("diary_entry_values")
            .select("entry_id, field_id, valor")
            .in("entry_id", entryIds);
          // Adjuntamos la fecha desde drecent
          const fechaByEntry: Record<string, string> = {};
          (drecent.data ?? []).forEach((e: any) => { fechaByEntry[e.id] = e.fecha; });
          setDiaryValues((vals ?? []).map((v: any) => ({ ...v, fecha: fechaByEntry[v.entry_id] })));
        } else {
          setDiaryValues([]);
        }

        // Auto-seleccionar primera marca con registros
        const firstMarkWithRecords = (allMarks.data ?? []).find((m: any) =>
          (mrecords.data ?? []).some((r: any) => r.mark_id === m.id && r.valor_numerico != null)
        );
        if (firstMarkWithRecords && !selectedMarkId) setSelectedMarkId(firstMarkWithRecords.id);
      } else {
        const [usuarios, opos, simulacros, ejercicios] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("oposiciones").select("id", { count: "exact", head: true }),
          supabase.from("simulacro_templates").select("id", { count: "exact", head: true }),
          supabase.from("exercises").select("id", { count: "exact", head: true }),
        ]);
        setStats({
          usuarios: usuarios.count ?? 0,
          oposiciones: opos.count ?? 0,
          simulacros: simulacros.count ?? 0,
          ejercicios: ejercicios.count ?? 0,
        });
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, primaryRole]);

  const userCards = [
    { key: "diario30", label: "Sesiones (30 días)", icon: BookOpen, to: "/app/diario" },
    { key: "rutinas", label: "Rutinas activas", icon: Dumbbell, to: "/app/rutinas" },
    { key: "simulacros", label: "Simulacros", icon: Target, to: "/app/simulacros" },
    { key: "marcas", label: "Marcas registradas", icon: Activity, to: "/app/evolucion" },
  ];
  const coachCards = [
    { key: "usuarios", label: "Deportistas", icon: Users, to: "/app/usuarios" },
    { key: "oposiciones", label: "Oposiciones", icon: Trophy, to: "/app/oposiciones" },
    { key: "simulacros", label: "Simulacros", icon: Target, to: "/app/simulacros" },
    { key: "ejercicios", label: "Ejercicios", icon: Dumbbell, to: "/app/ejercicios" },
  ];
  const cards = primaryRole === "usuario" ? userCards : coachCards;

  // Datos para gráfica diario
  const diaryChartData = useMemo(() => {
    if (!selectedFieldId) return [];
    return diaryValues
      .filter((v) => v.field_id === selectedFieldId && v.valor != null)
      .map((v) => ({ fecha: v.fecha?.slice(5) ?? "", valor: Number(v.valor) }))
      .filter((p) => !Number.isNaN(p.valor))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [diaryValues, selectedFieldId]);

  // Datos para gráfica de marca
  const markChartData = useMemo(() => {
    if (!selectedMarkId) return [];
    return markRecords
      .filter((r) => r.mark_id === selectedMarkId && r.valor_numerico != null)
      .map((r) => ({ fecha: r.fecha?.slice(0, 10).slice(5) ?? "", valor: Number(r.valor_numerico) }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [markRecords, selectedMarkId]);

  const marksWithRecords = useMemo(
    () => marks.filter((m) => markRecords.some((r) => r.mark_id === m.id && r.valor_numerico != null)),
    [marks, markRecords]
  );

  return (
    <div>
      <PageHeader
        title={primaryRole === "usuario" ? "Mi panel" : primaryRole === "entrenador" ? "Panel entrenador" : "Panel superadmin"}
        description={primaryRole === "usuario" ? "Tu progreso de un vistazo." : "Resumen de actividad de Corpore10."}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.key} to={c.to}>
            <Card className="hover:border-primary transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{c.label}</CardTitle>
                <c.icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="brand-title text-4xl text-primary">{stats[c.key] ?? 0}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {primaryRole === "usuario" ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="brand-title text-lg flex items-center gap-2"><Flame className="h-4 w-4 text-primary" /> Evolución del diario</CardTitle>
                  <CardDescription>Últimos 30 días</CardDescription>
                </div>
                {diaryFields.length > 0 && (
                  <Select value={selectedFieldId} onValueChange={setSelectedFieldId}>
                    <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {diaryFields.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </CardHeader>
              <CardContent>
                <MetricsChart data={diaryChartData} label={diaryFields.find((f) => f.id === selectedFieldId)?.label ?? "valor"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="brand-title text-lg flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Progresión de marca</CardTitle>
                  <CardDescription>Histórico completo</CardDescription>
                </div>
                {marksWithRecords.length > 0 && (
                  <Select value={selectedMarkId} onValueChange={setSelectedMarkId}>
                    <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Selecciona marca" /></SelectTrigger>
                    <SelectContent>
                      {marksWithRecords.map((m) => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </CardHeader>
              <CardContent>
                {marksWithRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Aún no tienes marcas numéricas registradas. <Link to="/app/marcas" className="text-primary hover:underline">Registrar →</Link></p>
                ) : (
                  <MetricsChart data={markChartData} label={marks.find((m) => m.id === selectedMarkId)?.nombre} />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="brand-title text-lg">Última entrada del diario</CardTitle>
              </CardHeader>
              <CardContent>
                {lastDiary ? (
                  <div className="text-sm space-y-1">
                    <div className="font-medium">{new Date(lastDiary.fecha).toLocaleDateString("es-ES")} · {lastDiary.session_types?.nombre ?? "Sin tipo"}</div>
                    <p className="text-muted-foreground line-clamp-3">{lastDiary.descripcion ?? "—"}</p>
                    <Link to="/app/diario" className="text-primary text-xs hover:underline">Ver diario →</Link>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aún no has registrado ninguna sesión. <Link to="/app/diario" className="text-primary hover:underline">Crear ahora</Link></p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="brand-title text-lg">Rutinas activas</CardTitle>
              </CardHeader>
              <CardContent>
                {activeRoutines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tienes rutinas asignadas todavía.</p>
                ) : (
                  <ul className="space-y-2">
                    {activeRoutines.map((r) => (
                      <li key={r.id} className="text-sm flex justify-between">
                        <span>{r.routines?.nombre}</span>
                        <span className="text-muted-foreground">{r.routines?.num_dias} días</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link to="/app/rutinas" className="text-primary text-xs hover:underline mt-2 inline-block">Ir a mis rutinas →</Link>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="brand-title">Bienvenido a Corpore10</CardTitle>
            <CardDescription>Gestiona deportistas, rutinas, simulacros y carga masiva de marcas desde el menú lateral.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
