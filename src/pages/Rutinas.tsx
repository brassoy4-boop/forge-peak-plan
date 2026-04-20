import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Calendar, Dumbbell, Trash2, Copy, FileDown, Search, Pencil, Users } from "lucide-react";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableItem } from "@/components/SortableItem";
import { ExercisePicker } from "@/components/ExercisePicker";
import { exportRoutinePdf } from "@/lib/pdf";

interface ProfileLite { user_id: string; nombre: string; apellidos: string; }

export default function Rutinas() {
  const { primaryRole, user } = useAuth();
  const isCoach = primaryRole === "entrenador" || primaryRole === "superadmin";

  const [routines, setRoutines] = useState<any[]>([]);
  const [days, setDays] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [routineExercises, setRoutineExercises] = useState<any[]>([]);
  const [assignmentsForUser, setAssignmentsForUser] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  // Editor (diálogo grande)
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null); // routine being edited (null = new)
  const [editForm, setEditForm] = useState({ nombre: "", descripcion: "", num_dias: 3 });
  const [activeTab, setActiveTab] = useState<string>("dia-1");
  const [exPickerOpen, setExPickerOpen] = useState(false);
  const [exPickerDayId, setExPickerDayId] = useState<string | null>(null);
  const [pendingDayChange, setPendingDayChange] = useState<number | null>(null);

  // Asignaciones (dentro del editor)
  const [coachUsers, setCoachUsers] = useState<ProfileLite[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfileLite>>({});
  const [routineAssignments, setRoutineAssignments] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignFechaInicio, setAssignFechaInicio] = useState("");
  const [assignFechaFin, setAssignFechaFin] = useState("");

  // Vista usuario (solo lectura)
  const [viewing, setViewing] = useState<any | null>(null);
  const [viewActiveDay, setViewActiveDay] = useState(1);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadAll = async () => {
    const [r, d, e, re, ra] = await Promise.all([
      supabase.from("routines").select("*").order("created_at", { ascending: false }),
      supabase.from("routine_days").select("*"),
      supabase.from("exercises").select("*").order("nombre"),
      supabase.from("routine_exercises").select("*").order("orden"),
      user ? supabase.from("routine_assignments").select("*, routines(*)").eq("user_id", user.id) : Promise.resolve({ data: [] } as any),
    ]);
    setRoutines(r.data ?? []); setDays(d.data ?? []); setExercises(e.data ?? []);
    setRoutineExercises(re.data ?? []); setAssignmentsForUser(ra.data ?? []);
  };

  const loadCoachUsers = async () => {
    if (!isCoach || !user) return;
    let profs: ProfileLite[] = [];
    if (primaryRole === "superadmin") {
      const { data } = await supabase.from("profiles").select("user_id, nombre, apellidos").order("nombre");
      profs = data ?? [];
    } else {
      const { data: ca } = await supabase.from("coach_assignments").select("user_id").eq("coach_id", user.id);
      const ids = (ca ?? []).map((c) => c.user_id);
      if (ids.length) {
        const { data } = await supabase.from("profiles").select("user_id, nombre, apellidos").in("user_id", ids).order("nombre");
        profs = data ?? [];
      }
    }
    setCoachUsers(profs);
    const m: Record<string, ProfileLite> = {};
    profs.forEach((p) => { m[p.user_id] = p; });
    setProfilesMap(m);
  };

  useEffect(() => { loadAll(); loadCoachUsers(); }, [user, primaryRole]);

  // ============ CREATE / EDIT ============
  const openNew = () => {
    setEditing(null);
    setEditForm({ nombre: "", descripcion: "", num_dias: 3 });
    setActiveTab("dia-1");
    setRoutineAssignments([]);
    setSelectedUserIds([]);
    setEditorOpen(true);
  };

  const openEdit = async (r: any) => {
    setEditing(r);
    setEditForm({ nombre: r.nombre, descripcion: r.descripcion ?? "", num_dias: r.num_dias });
    setActiveTab("dia-1");
    setSelectedUserIds([]);
    const { data: ra } = await supabase.from("routine_assignments").select("*").eq("routine_id", r.id);
    setRoutineAssignments(ra ?? []);
    // Asegura que los perfiles asignados estén en el map (por si superadmin viene con otro coach)
    const missing = (ra ?? []).map((a: any) => a.user_id).filter((id: string) => !profilesMap[id]);
    if (missing.length) {
      const { data: extra } = await supabase.from("profiles").select("user_id, nombre, apellidos").in("user_id", missing);
      if (extra) {
        const m = { ...profilesMap };
        extra.forEach((p) => { m[p.user_id] = p; });
        setProfilesMap(m);
      }
    }
    setEditorOpen(true);
  };

  const saveHeader = async () => {
    if (!editForm.nombre.trim()) { toast.error("El nombre es obligatorio"); return null; }
    if (editing) {
      const { error } = await supabase.from("routines").update({
        nombre: editForm.nombre, descripcion: editForm.descripcion, num_dias: editForm.num_dias,
      }).eq("id", editing.id);
      if (error) { toast.error(error.message); return null; }
      return editing.id;
    } else {
      const { data, error } = await supabase.from("routines").insert({
        nombre: editForm.nombre, descripcion: editForm.descripcion,
        num_dias: editForm.num_dias, created_by: user?.id,
      }).select().single();
      if (error || !data) { toast.error(error?.message ?? "Error"); return null; }
      const dayInserts = Array.from({ length: editForm.num_dias }, (_, i) => ({
        routine_id: data.id, dia_num: i + 1, nombre: `Día ${i + 1}`,
      }));
      await supabase.from("routine_days").insert(dayInserts);
      setEditing(data);
      toast.success("Rutina creada");
      return data.id;
    }
  };

  // Cambio número de días: ajusta routine_days
  const applyNumDiasChange = async (newNum: number) => {
    if (!editing) { setEditForm((f) => ({ ...f, num_dias: newNum })); return; }
    const current = days.filter((d) => d.routine_id === editing.id);
    if (newNum > current.length) {
      const toAdd = Array.from({ length: newNum - current.length }, (_, i) => ({
        routine_id: editing.id, dia_num: current.length + i + 1, nombre: `Día ${current.length + i + 1}`,
      }));
      await supabase.from("routine_days").insert(toAdd);
    } else if (newNum < current.length) {
      const toRemove = current.filter((d) => d.dia_num > newNum);
      const removeIds = toRemove.map((d) => d.id);
      const exInRemoved = routineExercises.filter((re) => removeIds.includes(re.routine_day_id));
      if (exInRemoved.length) {
        await supabase.from("routine_exercises").delete().in("routine_day_id", removeIds);
      }
      await supabase.from("routine_days").delete().in("id", removeIds);
    }
    await supabase.from("routines").update({ num_dias: newNum }).eq("id", editing.id);
    setEditForm((f) => ({ ...f, num_dias: newNum }));
    if (Number(activeTab.replace("dia-", "")) > newNum) setActiveTab(`dia-${newNum}`);
    await loadAll();
  };

  const handleNumDiasChange = (raw: number) => {
    const newNum = Math.max(1, Math.min(7, raw));
    if (!editing) { setEditForm((f) => ({ ...f, num_dias: newNum })); return; }
    const current = days.filter((d) => d.routine_id === editing.id);
    if (newNum < current.length) {
      const toRemove = current.filter((d) => d.dia_num > newNum).map((d) => d.id);
      const hasEx = routineExercises.some((re) => toRemove.includes(re.routine_day_id));
      if (hasEx) { setPendingDayChange(newNum); return; }
    }
    applyNumDiasChange(newNum);
  };

  // ============ DAY NAME ============
  const renameDay = async (dayId: string, nombre: string) => {
    await supabase.from("routine_days").update({ nombre }).eq("id", dayId);
    setDays((prev) => prev.map((d) => d.id === dayId ? { ...d, nombre } : d));
  };

  // ============ EXERCISES ============
  const openExPickerForDay = (dayId: string) => {
    setExPickerDayId(dayId);
    setExPickerOpen(true);
  };

  const addExerciseToDay = async (params: {
    exercise_id: string; series: number; repeticiones: string; descanso: string; tiempo: string; carga: string;
  }) => {
    if (!exPickerDayId) return;
    const orden = routineExercises.filter((re) => re.routine_day_id === exPickerDayId).length;
    const { error } = await supabase.from("routine_exercises").insert({
      routine_day_id: exPickerDayId, ...params, orden,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Ejercicio añadido");
    setExPickerOpen(false);
    await loadAll();
  };

  const updateExerciseField = async (id: string, field: string, value: any) => {
    setRoutineExercises((prev) => prev.map((re) => re.id === id ? { ...re, [field]: value } : re));
    const patch: Record<string, any> = { [field]: value };
    await supabase.from("routine_exercises").update(patch as any).eq("id", id);
  };

  const removeExercise = async (id: string) => {
    const { error } = await supabase.from("routine_exercises").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Ejercicio eliminado");
    await loadAll();
  };

  const handleDragEnd = async (event: DragEndEvent, dayId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const dayEx = routineExercises.filter((re) => re.routine_day_id === dayId).sort((a, b) => a.orden - b.orden);
    const oldIndex = dayEx.findIndex((re) => re.id === active.id);
    const newIndex = dayEx.findIndex((re) => re.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(dayEx, oldIndex, newIndex);
    const others = routineExercises.filter((re) => re.routine_day_id !== dayId);
    const updated = reordered.map((re, idx) => ({ ...re, orden: idx }));
    setRoutineExercises([...others, ...updated]);
    await Promise.all(updated.map((re) => supabase.from("routine_exercises").update({ orden: re.orden }).eq("id", re.id)));
  };

  // ============ ASSIGNMENTS ============
  const filteredCoachUsers = useMemo(() => {
    if (!assignSearch.trim()) return coachUsers;
    const q = assignSearch.toLowerCase();
    return coachUsers.filter((u) => `${u.nombre} ${u.apellidos}`.toLowerCase().includes(q));
  }, [coachUsers, assignSearch]);

  const toggleUserSelection = (id: string) => {
    setSelectedUserIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const assignToSelected = async () => {
    if (!editing || selectedUserIds.length === 0) return;
    const rows = selectedUserIds.map((uid) => ({
      routine_id: editing.id,
      user_id: uid,
      assigned_by: user?.id,
      activa: true,
      fecha_inicio: assignFechaInicio || null,
      fecha_fin: assignFechaFin || null,
    }));
    const { error } = await supabase.from("routine_assignments").insert(rows);
    if (error) { toast.error(error.message); return; }
    // Notificar a cada usuario
    await supabase.from("notifications").insert(selectedUserIds.map((uid) => ({
      user_id: uid, tipo: "rutina",
      titulo: "Nueva rutina asignada",
      contenido: editing.nombre,
      link: "/app/rutinas",
    })));
    toast.success(`Rutina asignada a ${selectedUserIds.length} deportista(s)`);
    setSelectedUserIds([]);
    setAssignFechaInicio(""); setAssignFechaFin("");
    const { data: ra } = await supabase.from("routine_assignments").select("*").eq("routine_id", editing.id);
    setRoutineAssignments(ra ?? []);
  };

  const toggleAssignmentActive = async (assignmentId: string, activa: boolean) => {
    await supabase.from("routine_assignments").update({ activa }).eq("id", assignmentId);
    setRoutineAssignments((prev) => prev.map((a) => a.id === assignmentId ? { ...a, activa } : a));
  };

  const removeAssignment = async (assignmentId: string) => {
    await supabase.from("routine_assignments").delete().eq("id", assignmentId);
    setRoutineAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    toast.success("Asignación eliminada");
  };

  // ============ DUPLICATE / DELETE ============
  const duplicateRoutine = async (r: any) => {
    const { data: nr, error } = await supabase.from("routines").insert({
      nombre: `${r.nombre} (copia)`, descripcion: r.descripcion, num_dias: r.num_dias, created_by: user?.id,
    }).select().single();
    if (error || !nr) return toast.error(error?.message ?? "Error");
    const origDays = days.filter((d) => d.routine_id === r.id);
    if (origDays.length) {
      const { data: newDays } = await supabase.from("routine_days").insert(
        origDays.map((d) => ({ routine_id: nr.id, dia_num: d.dia_num, nombre: d.nombre }))
      ).select();
      const dayIdMap: Record<string, string> = {};
      origDays.forEach((od) => {
        const nd = (newDays ?? []).find((x: any) => x.dia_num === od.dia_num);
        if (nd) dayIdMap[od.id] = nd.id;
      });
      const origEx = routineExercises.filter((re) => origDays.some((d) => d.id === re.routine_day_id));
      if (origEx.length) {
        await supabase.from("routine_exercises").insert(
          origEx.map((e) => ({
            routine_day_id: dayIdMap[e.routine_day_id], exercise_id: e.exercise_id,
            series: e.series, repeticiones: e.repeticiones, descanso: e.descanso,
            tiempo: e.tiempo, carga: e.carga, observaciones: e.observaciones, orden: e.orden,
          }))
        );
      }
    }
    toast.success("Rutina duplicada"); loadAll();
  };

  // ============ EXPORT ============
  const exportPdf = async (r: any) => {
    const rDays = days.filter((d) => d.routine_id === r.id).sort((a, b) => a.dia_num - b.dia_num);
    const dayIds = rDays.map((d) => d.id);
    const dayEx = routineExercises.filter((re) => dayIds.includes(re.routine_day_id)).sort((a, b) => a.orden - b.orden);
    await exportRoutinePdf({
      nombre: r.nombre,
      descripcion: r.descripcion,
      num_dias: r.num_dias,
      days: rDays.map((d) => ({
        dia_num: d.dia_num,
        nombre: d.nombre,
        exercises: dayEx.filter((re) => re.routine_day_id === d.id).map((re) => {
          const ex = exercises.find((e) => e.id === re.exercise_id);
          return {
            nombre: ex?.nombre ?? "—",
            series: re.series, repeticiones: re.repeticiones,
            descanso: re.descanso, tiempo: re.tiempo,
            carga: re.carga, observaciones: re.observaciones,
            imagen_url: ex?.imagen_url ?? null,
          };
        }),
      })),
    });
  };

  // ============ LISTING ============
  const visibleRoutines = primaryRole === "usuario"
    ? assignmentsForUser.filter((a) => a.activa).map((a) => a.routines).filter(Boolean)
    : routines;
  const filteredRoutines = visibleRoutines.filter((r: any) =>
    !search.trim() || r.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const editingDays = editing ? days.filter((d) => d.routine_id === editing.id).sort((a, b) => a.dia_num - b.dia_num) : [];
  const tabsCount = editing ? editingDays.length : editForm.num_dias;

  return (
    <div>
      <PageHeader
        title={primaryRole === "usuario" ? "Mis rutinas" : "Rutinas"}
        description="Planes de entrenamiento de 1 a 7 días."
        actions={isCoach && (
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Nueva rutina</Button>
        )}
      />

      {/* Vista usuario (solo lectura) */}
      {viewing ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setViewing(null)}>← Volver</Button>
            <Button variant="outline" size="sm" onClick={() => exportPdf(viewing)}><FileDown className="h-4 w-4 mr-2" /> Exportar PDF</Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="brand-title text-2xl">{viewing.nombre}</CardTitle>
              <CardDescription>{viewing.descripcion}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {Array.from({ length: viewing.num_dias }, (_, i) => i + 1).map((n) => (
                  <Button key={n} variant={viewActiveDay === n ? "default" : "outline"} size="sm" onClick={() => setViewActiveDay(n)}>Día {n}</Button>
                ))}
              </div>
              {(() => {
                const day = days.find((d) => d.routine_id === viewing.id && d.dia_num === viewActiveDay);
                const dayEx = routineExercises.filter((re) => re.routine_day_id === day?.id).sort((a, b) => a.orden - b.orden);
                return (
                  <div className="space-y-2">
                    {dayEx.map((re) => {
                      const ex = exercises.find((e) => e.id === re.exercise_id);
                      return (
                        <div key={re.id} className="flex items-center gap-3 p-3 border rounded-md bg-card">
                          <div className="w-12 h-12 bg-muted rounded flex items-center justify-center overflow-hidden">
                            {ex?.imagen_url ? <img src={ex.imagen_url} className="w-full h-full object-cover" alt="" /> : <Dumbbell className="h-6 w-6 text-muted-foreground" />}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{ex?.nombre}</div>
                            <div className="text-xs text-muted-foreground">{re.series ?? "—"} series · {re.repeticiones ?? "—"} reps · descanso {re.descanso ?? "—"}</div>
                          </div>
                        </div>
                      );
                    })}
                    {dayEx.length === 0 && <p className="text-sm text-muted-foreground">Sin ejercicios este día.</p>}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div className="mb-4 relative max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar rutina..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRoutines.map((r: any) => (
              <Card key={r.id} className="hover:border-primary">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle
                      className="brand-title text-xl cursor-pointer flex-1"
                      onClick={() => isCoach ? openEdit(r) : (setViewing(r), setViewActiveDay(1))}
                    >
                      {r.nombre}
                    </CardTitle>
                    <Badge><Calendar className="mr-1 h-3 w-3" />{r.num_dias} días</Badge>
                  </div>
                  {r.descripcion && <CardDescription>{r.descripcion}</CardDescription>}
                </CardHeader>
                <CardContent className="flex gap-2 pt-0 flex-wrap">
                  {isCoach ? (
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)}><Pencil className="h-3 w-3 mr-1" /> Editar</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => { setViewing(r); setViewActiveDay(1); }}>Ver</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => exportPdf(r)} title="Descargar PDF"><FileDown className="h-3 w-3 mr-1" /> PDF</Button>
                  {isCoach && (
                    <Button size="sm" variant="ghost" onClick={() => duplicateRoutine(r)}><Copy className="h-3 w-3 mr-1" /> Duplicar</Button>
                  )}
                </CardContent>
              </Card>
            ))}
            {filteredRoutines.length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">No hay rutinas.</p>}
          </div>
        </>
      )}

      {/* ===== Editor diálogo grande ===== */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="!flex h-[92vh] max-w-6xl min-h-0 flex-col gap-0 p-0">
          <DialogHeader className="shrink-0 px-6 pt-6">
            <DialogTitle>{editing ? `Editar rutina: ${editing.nombre}` : "Nueva rutina"}</DialogTitle>
          </DialogHeader>

          <div className="shrink-0 px-6 pb-2 pt-3 grid grid-cols-1 md:grid-cols-[1fr,1fr,140px] gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre</Label>
              <Input
                value={editForm.nombre}
                onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                onBlur={() => { if (editing) supabase.from("routines").update({ nombre: editForm.nombre }).eq("id", editing.id); }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descripción</Label>
              <Input
                value={editForm.descripcion}
                onChange={(e) => setEditForm({ ...editForm, descripcion: e.target.value })}
                onBlur={() => { if (editing) supabase.from("routines").update({ descripcion: editForm.descripcion }).eq("id", editing.id); }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Días (1-7)</Label>
              <Input
                type="number"
                min={1}
                max={7}
                value={editForm.num_dias}
                onChange={(e) => handleNumDiasChange(Number(e.target.value))}
              />
            </div>
          </div>

          {!editing ? (
            <div className="flex-1 flex items-center justify-center px-6">
              <div className="text-center space-y-3">
                <p className="text-muted-foreground">Crea la rutina para empezar a añadir días, ejercicios y asignaciones.</p>
                <Button onClick={async () => { const id = await saveHeader(); if (id) await loadAll(); }}>
                  Crear rutina
                </Button>
              </div>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col overflow-hidden px-6">
              <TabsList className="flex-wrap h-auto justify-start">
                {Array.from({ length: tabsCount }, (_, i) => i + 1).map((n) => (
                  <TabsTrigger key={n} value={`dia-${n}`}>Día {n}</TabsTrigger>
                ))}
                <TabsTrigger value="asignaciones"><Users className="h-4 w-4 mr-1" /> Asignaciones</TabsTrigger>
              </TabsList>

              {Array.from({ length: tabsCount }, (_, i) => i + 1).map((n) => {
                const day = editingDays.find((d) => d.dia_num === n);
                if (!day) return null;
                const dayEx = routineExercises.filter((re) => re.routine_day_id === day.id).sort((a, b) => a.orden - b.orden);
                return (
                  <TabsContent key={n} value={`dia-${n}`} className="mt-4 data-[state=active]:flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="flex shrink-0 items-center gap-2 mb-3">
                      <Label className="text-xs whitespace-nowrap">Nombre del día:</Label>
                      <Input
                        defaultValue={day.nombre ?? ""}
                        onBlur={(e) => renameDay(day.id, e.target.value)}
                        className="max-w-md"
                      />
                      <Button size="sm" variant="outline" onClick={() => openExPickerForDay(day.id)}>
                        <Plus className="h-4 w-4 mr-1" /> Añadir ejercicio
                      </Button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto pr-2 h-full">
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, day.id)}>
                        <SortableContext items={dayEx.map((re) => re.id)} strategy={verticalListSortingStrategy}>
                          <div className="space-y-2">
                            {dayEx.map((re) => {
                              const ex = exercises.find((e) => e.id === re.exercise_id);
                              return (
                                <SortableItem key={re.id} id={re.id}>
                                  <div className="flex items-center gap-3 p-2 border rounded-md bg-card">
                                    <div className="w-14 h-14 bg-muted rounded flex items-center justify-center overflow-hidden shrink-0">
                                      {ex?.imagen_url ? <img src={ex.imagen_url} className="w-full h-full object-cover" alt="" /> : <Dumbbell className="h-6 w-6 text-muted-foreground" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-sm truncate">{ex?.nombre ?? "—"}</div>
                                      <div className="grid grid-cols-5 gap-1 mt-1">
                                        <Input className="h-7 text-xs" defaultValue={re.series ?? ""} placeholder="Series" type="number"
                                          onBlur={(e) => updateExerciseField(re.id, "series", e.target.value ? Number(e.target.value) : null)} />
                                        <Input className="h-7 text-xs" defaultValue={re.repeticiones ?? ""} placeholder="Reps"
                                          onBlur={(e) => updateExerciseField(re.id, "repeticiones", e.target.value || null)} />
                                        <Input className="h-7 text-xs" defaultValue={re.tiempo ?? ""} placeholder="Tiempo"
                                          onBlur={(e) => updateExerciseField(re.id, "tiempo", e.target.value || null)} />
                                        <Input className="h-7 text-xs" defaultValue={re.carga ?? ""} placeholder="Carga"
                                          onBlur={(e) => updateExerciseField(re.id, "carga", e.target.value || null)} />
                                        <Input className="h-7 text-xs" defaultValue={re.descanso ?? ""} placeholder="Descanso"
                                          onBlur={(e) => updateExerciseField(re.id, "descanso", e.target.value || null)} />
                                      </div>
                                      <Input className="h-7 text-xs mt-1" defaultValue={re.observaciones ?? ""} placeholder="Observaciones"
                                        onBlur={(e) => updateExerciseField(re.id, "observaciones", e.target.value || null)} />
                                    </div>
                                    <Button size="icon" variant="ghost" onClick={() => removeExercise(re.id)} title="Eliminar">
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </SortableItem>
                              );
                            })}
                            {dayEx.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sin ejercicios este día.</p>}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  </TabsContent>
                );
              })}

              <TabsContent value="asignaciones" className="flex-1 overflow-hidden flex flex-col mt-4">
                <ScrollArea className="flex-1 pr-2">
                  <div className="space-y-4">
                    <Card>
                      <CardHeader><CardTitle className="text-base">Asignar a deportistas</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="md:col-span-3 relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-8" placeholder="Buscar deportista..." value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} />
                          </div>
                          <div className="space-y-1"><Label className="text-xs">Fecha inicio (opcional)</Label>
                            <Input type="date" value={assignFechaInicio} onChange={(e) => setAssignFechaInicio(e.target.value)} />
                          </div>
                          <div className="space-y-1"><Label className="text-xs">Fecha fin (opcional)</Label>
                            <Input type="date" value={assignFechaFin} onChange={(e) => setAssignFechaFin(e.target.value)} />
                          </div>
                          <div className="flex items-end">
                            <Button className="w-full" onClick={assignToSelected} disabled={selectedUserIds.length === 0}>
                              Asignar ({selectedUserIds.length})
                            </Button>
                          </div>
                        </div>
                        <div className="border rounded-md max-h-64 overflow-auto divide-y">
                          {filteredCoachUsers.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">Sin deportistas disponibles.</p>}
                          {filteredCoachUsers.map((u) => {
                            const already = routineAssignments.some((a) => a.user_id === u.user_id);
                            return (
                              <label key={u.user_id} className={`flex items-center gap-3 p-2 cursor-pointer hover:bg-muted/50 ${already ? "opacity-50" : ""}`}>
                                <Checkbox
                                  checked={selectedUserIds.includes(u.user_id)}
                                  onCheckedChange={() => !already && toggleUserSelection(u.user_id)}
                                  disabled={already}
                                />
                                <span className="text-sm">{u.nombre} {u.apellidos}</span>
                                {already && <Badge variant="secondary" className="ml-auto text-[10px]">Ya asignada</Badge>}
                              </label>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader><CardTitle className="text-base">Asignaciones actuales ({routineAssignments.length})</CardTitle></CardHeader>
                      <CardContent>
                        {routineAssignments.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Aún no hay asignaciones.</p>
                        ) : (
                          <div className="divide-y">
                            {routineAssignments.map((a) => {
                              const p = profilesMap[a.user_id];
                              return (
                                <div key={a.id} className="flex items-center gap-3 py-2">
                                  <div className="flex-1">
                                    <div className="text-sm font-medium">{p ? `${p.nombre} ${p.apellidos}` : a.user_id.slice(0, 8)}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {a.fecha_inicio ? `Desde ${a.fecha_inicio}` : "Sin fecha inicio"}
                                      {a.fecha_fin ? ` · hasta ${a.fecha_fin}` : ""}
                                    </div>
                                  </div>
                                  <Badge variant={a.activa ? "default" : "secondary"}>{a.activa ? "Activa" : "Inactiva"}</Badge>
                                  <Button size="sm" variant="outline" onClick={() => toggleAssignmentActive(a.id, !a.activa)}>
                                    {a.activa ? "Desactivar" : "Activar"}
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => removeAssignment(a.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="px-6 pb-6 pt-2">
            <Button variant="outline" onClick={() => { setEditorOpen(false); loadAll(); }}>Cerrar</Button>
            {editing && (
              <Button onClick={() => exportPdf(editing)}><FileDown className="h-4 w-4 mr-2" /> Exportar PDF</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Selector de ejercicios */}
      <ExercisePicker
        open={exPickerOpen}
        onOpenChange={setExPickerOpen}
        onAdd={addExerciseToDay}
      />

      {/* Confirmación reducir días */}
      <AlertDialog open={pendingDayChange !== null} onOpenChange={(o) => !o && setPendingDayChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reducir días</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar días que tienen ejercicios. Estos se borrarán de forma permanente. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendingDayChange !== null) { applyNumDiasChange(pendingDayChange); setPendingDayChange(null); } }}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
