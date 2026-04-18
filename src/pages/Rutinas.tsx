import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Dumbbell, Trash2, Copy, FileDown, Search } from "lucide-react";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableItem } from "@/components/SortableItem";
import { exportRoutinePdf } from "@/lib/pdf";

export default function Rutinas() {
  const { primaryRole, user } = useAuth();
  const isCoach = primaryRole === "entrenador" || primaryRole === "superadmin";
  const [routines, setRoutines] = useState<any[]>([]);
  const [days, setDays] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [routineExercises, setRoutineExercises] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nombre: "", descripcion: "", num_dias: 3 });
  const [selected, setSelected] = useState<any | null>(null);
  const [activeDay, setActiveDay] = useState(1);
  const [exOpen, setExOpen] = useState(false);
  const [exForm, setExForm] = useState({ exercise_id: "", series: 3, repeticiones: "10", descanso: "60s" });
  const [search, setSearch] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = async () => {
    const [r, d, e, re, ra] = await Promise.all([
      supabase.from("routines").select("*").order("created_at", { ascending: false }),
      supabase.from("routine_days").select("*"),
      supabase.from("exercises").select("*").order("nombre"),
      supabase.from("routine_exercises").select("*").order("orden"),
      user ? supabase.from("routine_assignments").select("*, routines(*)").eq("user_id", user.id) : Promise.resolve({ data: [] } as any),
    ]);
    setRoutines(r.data ?? []); setDays(d.data ?? []); setExercises(e.data ?? []);
    setRoutineExercises(re.data ?? []); setAssignments(ra.data ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const createRoutine = async () => {
    if (!form.nombre.trim()) return;
    const { data, error } = await supabase.from("routines").insert({ ...form, created_by: user?.id }).select().single();
    if (error) return toast.error(error.message);
    const dayInserts = Array.from({ length: form.num_dias }, (_, i) => ({ routine_id: data.id, dia_num: i + 1, nombre: `Día ${i + 1}` }));
    await supabase.from("routine_days").insert(dayInserts);
    toast.success("Rutina creada"); setOpen(false); setForm({ nombre: "", descripcion: "", num_dias: 3 });
    load();
  };

  const addExercise = async () => {
    if (!selected || !exForm.exercise_id) return;
    const day = days.find(d => d.routine_id === selected.id && d.dia_num === activeDay);
    if (!day) return;
    const orden = routineExercises.filter(re => re.routine_day_id === day.id).length;
    const { error } = await supabase.from("routine_exercises").insert({ routine_day_id: day.id, ...exForm, orden });
    if (error) return toast.error(error.message);
    toast.success("Ejercicio añadido"); setExOpen(false); load();
  };

  const removeExercise = async (id: string) => {
    const { error } = await supabase.from("routine_exercises").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Ejercicio eliminado"); load();
  };

  const duplicateRoutine = async (r: any) => {
    const { data: nr, error } = await supabase.from("routines").insert({
      nombre: `${r.nombre} (copia)`, descripcion: r.descripcion, num_dias: r.num_dias, created_by: user?.id,
    }).select().single();
    if (error || !nr) return toast.error(error?.message ?? "Error");
    const origDays = days.filter(d => d.routine_id === r.id);
    if (origDays.length) {
      const { data: newDays } = await supabase.from("routine_days").insert(
        origDays.map(d => ({ routine_id: nr.id, dia_num: d.dia_num, nombre: d.nombre }))
      ).select();
      const dayIdMap: Record<string, string> = {};
      origDays.forEach(od => {
        const nd = (newDays ?? []).find((x: any) => x.dia_num === od.dia_num);
        if (nd) dayIdMap[od.id] = nd.id;
      });
      const origEx = routineExercises.filter(re => origDays.some(d => d.id === re.routine_day_id));
      if (origEx.length) {
        await supabase.from("routine_exercises").insert(
          origEx.map(e => ({
            routine_day_id: dayIdMap[e.routine_day_id], exercise_id: e.exercise_id,
            series: e.series, repeticiones: e.repeticiones, descanso: e.descanso,
            tiempo: e.tiempo, carga: e.carga, observaciones: e.observaciones, orden: e.orden,
          }))
        );
      }
    }
    toast.success("Rutina duplicada"); load();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selected) return;
    const day = days.find(d => d.routine_id === selected.id && d.dia_num === activeDay);
    if (!day) return;
    const dayEx = routineExercises.filter(re => re.routine_day_id === day.id).sort((a, b) => a.orden - b.orden);
    const oldIndex = dayEx.findIndex(re => re.id === active.id);
    const newIndex = dayEx.findIndex(re => re.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(dayEx, oldIndex, newIndex);
    // Optimistic update
    const others = routineExercises.filter(re => re.routine_day_id !== day.id);
    const updated = reordered.map((re, idx) => ({ ...re, orden: idx }));
    setRoutineExercises([...others, ...updated]);
    // Persist
    await Promise.all(updated.map(re => supabase.from("routine_exercises").update({ orden: re.orden }).eq("id", re.id)));
  };

  const exportPdf = async (r: any) => {
    const rDays = days.filter(d => d.routine_id === r.id).sort((a, b) => a.dia_num - b.dia_num);
    const dayIds = rDays.map(d => d.id);
    const dayEx = routineExercises.filter(re => dayIds.includes(re.routine_day_id)).sort((a, b) => a.orden - b.orden);
    exportRoutinePdf({
      nombre: r.nombre,
      descripcion: r.descripcion,
      num_dias: r.num_dias,
      days: rDays.map(d => ({
        dia_num: d.dia_num,
        nombre: d.nombre,
        exercises: dayEx.filter(re => re.routine_day_id === d.id).map(re => {
          const ex = exercises.find(e => e.id === re.exercise_id);
          return {
            nombre: ex?.nombre ?? "—",
            series: re.series, repeticiones: re.repeticiones,
            descanso: re.descanso, tiempo: re.tiempo,
            carga: re.carga, observaciones: re.observaciones,
          };
        }),
      })),
    });
  };

  const visibleRoutines = primaryRole === "usuario"
    ? assignments.filter(a => a.activa).map(a => a.routines).filter(Boolean)
    : routines;
  const filteredRoutines = visibleRoutines.filter((r: any) =>
    !search.trim() || r.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader title={primaryRole === "usuario" ? "Mis rutinas" : "Rutinas"}
        description="Planes de entrenamiento de 1 a 7 días."
        actions={isCoach && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Nueva rutina</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nueva rutina</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2"><Label>Nombre</Label><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
                <div className="space-y-2"><Label>Descripción</Label><Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
                <div className="space-y-2"><Label>Días (1-7)</Label><Input type="number" min={1} max={7} value={form.num_dias} onChange={(e) => setForm({ ...form, num_dias: Number(e.target.value) })} /></div>
              </div>
              <DialogFooter><Button onClick={createRoutine}>Crear</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />
      {!selected ? (
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
                    <CardTitle className="brand-title text-xl cursor-pointer flex-1" onClick={() => { setSelected(r); setActiveDay(1); }}>{r.nombre}</CardTitle>
                    <Badge><Calendar className="mr-1 h-3 w-3" />{r.num_dias} días</Badge>
                  </div>
                  {r.descripcion && <CardDescription>{r.descripcion}</CardDescription>}
                </CardHeader>
                <CardContent className="flex gap-2 pt-0 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => { setSelected(r); setActiveDay(1); }}>{isCoach ? "Editar" : "Ver"}</Button>
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
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setSelected(null)}>← Volver</Button>
            <Button variant="outline" size="sm" onClick={() => exportPdf(selected)}><FileDown className="h-4 w-4 mr-2" /> Exportar PDF</Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="brand-title text-2xl">{selected.nombre}</CardTitle>
              <CardDescription>{selected.descripcion}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {Array.from({ length: selected.num_dias }, (_, i) => i + 1).map(n => (
                  <Button key={n} variant={activeDay === n ? "default" : "outline"} size="sm" onClick={() => setActiveDay(n)}>Día {n}</Button>
                ))}
              </div>
              {(() => {
                const day = days.find(d => d.routine_id === selected.id && d.dia_num === activeDay);
                const dayEx = routineExercises.filter(re => re.routine_day_id === day?.id).sort((a, b) => a.orden - b.orden);
                return (
                  <div className="space-y-2">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={dayEx.map(re => re.id)} strategy={verticalListSortingStrategy}>
                        {dayEx.map((re) => {
                          const ex = exercises.find(e => e.id === re.exercise_id);
                          return (
                            <SortableItem key={re.id} id={re.id} disabled={!isCoach}>
                              <div className="flex items-center gap-3 p-3 border rounded-md bg-card">
                                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center overflow-hidden">
                                  {ex?.imagen_url ? <img src={ex.imagen_url} className="w-full h-full object-cover" alt="" /> : <Dumbbell className="h-6 w-6 text-muted-foreground" />}
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium">{ex?.nombre}</div>
                                  <div className="text-xs text-muted-foreground">{re.series} series · {re.repeticiones} reps · descanso {re.descanso}</div>
                                </div>
                                {isCoach && (
                                  <Button size="icon" variant="ghost" onClick={() => removeExercise(re.id)} title="Eliminar">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </SortableItem>
                          );
                        })}
                      </SortableContext>
                    </DndContext>
                    {dayEx.length === 0 && <p className="text-sm text-muted-foreground">Sin ejercicios este día.</p>}
                    {isCoach && (
                      <Dialog open={exOpen} onOpenChange={setExOpen}>
                        <DialogTrigger asChild><Button variant="outline" className="w-full"><Plus className="mr-2 h-4 w-4" /> Añadir ejercicio</Button></DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Añadir ejercicio (Día {activeDay})</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <div className="space-y-2"><Label>Ejercicio</Label>
                              <Select value={exForm.exercise_id} onValueChange={(v) => setExForm({ ...exForm, exercise_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                <SelectContent>{exercises.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-2"><Label>Series</Label><Input type="number" value={exForm.series} onChange={(e) => setExForm({ ...exForm, series: Number(e.target.value) })} /></div>
                              <div className="space-y-2"><Label>Reps</Label><Input value={exForm.repeticiones} onChange={(e) => setExForm({ ...exForm, repeticiones: e.target.value })} /></div>
                              <div className="space-y-2"><Label>Descanso</Label><Input value={exForm.descanso} onChange={(e) => setExForm({ ...exForm, descanso: e.target.value })} /></div>
                            </div>
                          </div>
                          <DialogFooter><Button onClick={addExercise}>Añadir</Button></DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
