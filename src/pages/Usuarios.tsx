import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, UserCheck, Loader2, UserMinus, Search } from "lucide-react";
import { toast } from "sonner";

export default function Usuarios() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [oposiciones, setOposiciones] = useState<any[]>([]);
  const [userOpos, setUserOpos] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [routineAssignments, setRoutineAssignments] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", nombre: "", apellidos: "", sexo: "masculino" as "masculino" | "femenino" });
  const [search, setSearch] = useState("");
  const [routineDialog, setRoutineDialog] = useState<{ open: boolean; userId: string }>({ open: false, userId: "" });
  const [routineForm, setRoutineForm] = useState({ routine_id: "", fecha_inicio: "", fecha_fin: "" });

  const load = async () => {
    const [p, o, uo, ca, r, ra] = await Promise.all([
      supabase.from("profiles").select("*").order("nombre"),
      supabase.from("oposiciones").select("*"),
      supabase.from("user_oposiciones").select("*"),
      supabase.from("coach_assignments").select("*"),
      supabase.from("routines").select("*").eq("status", "activo"),
      supabase.from("routine_assignments").select("*"),
    ]);
    setProfiles(p.data ?? []); setOposiciones(o.data ?? []);
    setUserOpos(uo.data ?? []); setAssignments(ca.data ?? []);
    setRoutines(r.data ?? []); setRoutineAssignments(ra.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.email || !form.password) return toast.error("Email y contraseña requeridos");
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: {
        email: form.email, password: form.password, nombre: form.nombre, apellidos: form.apellidos,
        sexo: form.sexo, role: "usuario", assign_to_caller: true,
      },
    });
    setCreating(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error ?? error?.message ?? "Error");
    }
    toast.success("Deportista creado y asignado");
    setOpen(false);
    setForm({ email: "", password: "", nombre: "", apellidos: "", sexo: "masculino" });
    load();
  };

  const assignToCoach = async (userId: string) => {
    if (!user) return;
    const { error } = await supabase.from("coach_assignments").insert({ coach_id: user.id, user_id: userId });
    if (error) return toast.error(error.message);
    toast.success("Asignado a ti"); load();
  };

  const unassign = async (userId: string) => {
    if (!user) return;
    const { error } = await supabase.from("coach_assignments").delete().eq("coach_id", user.id).eq("user_id", userId);
    if (error) return toast.error(error.message);
    toast.success("Desasignado"); load();
  };

  const linkOpo = async (userId: string, opoId: string) => {
    const { error } = await supabase.from("user_oposiciones").insert({ user_id: userId, oposicion_id: opoId });
    if (error) return toast.error(error.message);
    toast.success("Oposición vinculada"); load();
  };

  const unlinkOpo = async (rowId: string) => {
    const { error } = await supabase.from("user_oposiciones").delete().eq("id", rowId);
    if (error) return toast.error(error.message);
    load();
  };

  const assignRoutine = async () => {
    if (!user || !routineForm.routine_id || !routineDialog.userId) return;
    const { error } = await supabase.from("routine_assignments").insert({
      user_id: routineDialog.userId,
      routine_id: routineForm.routine_id,
      assigned_by: user.id,
      fecha_inicio: routineForm.fecha_inicio || null,
      fecha_fin: routineForm.fecha_fin || null,
      activa: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Rutina asignada");
    setRoutineDialog({ open: false, userId: "" });
    setRoutineForm({ routine_id: "", fecha_inicio: "", fecha_fin: "" });
    load();
  };

  const toggleRoutineActive = async (id: string, activa: boolean) => {
    await supabase.from("routine_assignments").update({ activa: !activa }).eq("id", id);
    load();
  };

  const isMine = (userId: string) => assignments.some(a => a.user_id === userId && a.coach_id === user?.id);

  const filtered = profiles.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return `${p.nombre} ${p.apellidos} ${p.email ?? ""}`.toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader title="Usuarios" description="Gestión de deportistas, asignaciones, oposiciones y rutinas."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Nuevo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo deportista</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Nombre</Label><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Apellidos</Label><Input value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-2"><Label>Contraseña temporal</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
                <div className="space-y-2"><Label>Sexo</Label>
                  <Select value={form.sexo} onValueChange={(v) => setForm({ ...form, sexo: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem><SelectItem value="femenino">Femenino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">El usuario podrá iniciar sesión con email + contraseña + PIN del centro.</p>
              </div>
              <DialogFooter>
                <Button onClick={create} disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Buscar por nombre o email..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Sexo</TableHead>
                <TableHead>Oposiciones</TableHead>
                <TableHead>Rutinas activas</TableHead>
                <TableHead>Asignación</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const opos = userOpos.filter(uo => uo.user_id === p.user_id);
                const userRoutines = routineAssignments.filter(ra => ra.user_id === p.user_id);
                const mine = isMine(p.user_id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nombre} {p.apellidos}</TableCell>
                    <TableCell className="text-sm">{p.email}</TableCell>
                    <TableCell><Badge variant="outline">{p.sexo ?? "—"}</Badge></TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-wrap gap-1">
                        {opos.map((uo) => {
                          const o = oposiciones.find(x => x.id === uo.oposicion_id);
                          return o ? (
                            <Badge key={uo.id} variant="secondary" className="cursor-pointer" onClick={() => unlinkOpo(uo.id)} title="Click para quitar">
                              {o.nombre} ×
                            </Badge>
                          ) : null;
                        })}
                        {opos.length === 0 && "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-wrap gap-1">
                        {userRoutines.map((ra) => {
                          const r = routines.find(x => x.id === ra.routine_id);
                          return r ? (
                            <Badge key={ra.id} variant={ra.activa ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleRoutineActive(ra.id, ra.activa)} title="Click para activar/desactivar">
                              {r.nombre}
                            </Badge>
                          ) : null;
                        })}
                        {userRoutines.length === 0 && "—"}
                      </div>
                    </TableCell>
                    <TableCell>{mine ? <Badge>Asignado a ti</Badge> : <Badge variant="outline">—</Badge>}</TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      <Select onValueChange={(v) => linkOpo(p.user_id, v)}>
                        <SelectTrigger className="w-32 inline-flex"><SelectValue placeholder="+ Oposición" /></SelectTrigger>
                        <SelectContent>{oposiciones.map(o => <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" onClick={() => setRoutineDialog({ open: true, userId: p.user_id })}>+ Rutina</Button>
                      {mine ? (
                        <Button variant="outline" size="sm" onClick={() => unassign(p.user_id)} title="Desasignar"><UserMinus className="h-3 w-3" /></Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => assignToCoach(p.user_id)} title="Asignar a ti"><UserCheck className="h-3 w-3" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin resultados.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={routineDialog.open} onOpenChange={(o) => setRoutineDialog({ open: o, userId: routineDialog.userId })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Asignar rutina</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2"><Label>Rutina</Label>
              <Select value={routineForm.routine_id} onValueChange={(v) => setRoutineForm({ ...routineForm, routine_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{routines.map(r => <SelectItem key={r.id} value={r.id}>{r.nombre} ({r.num_dias}d)</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Inicio</Label><Input type="date" value={routineForm.fecha_inicio} onChange={(e) => setRoutineForm({ ...routineForm, fecha_inicio: e.target.value })} /></div>
              <div className="space-y-2"><Label>Fin</Label><Input type="date" value={routineForm.fecha_fin} onChange={(e) => setRoutineForm({ ...routineForm, fecha_fin: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={assignRoutine} disabled={!routineForm.routine_id}>Asignar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
