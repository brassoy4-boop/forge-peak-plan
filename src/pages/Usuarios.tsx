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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Loader2, Search, Pencil, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function Usuarios() {
  const { user, primaryRole } = useAuth();
  const isSuper = primaryRole === "superadmin";
  const [profiles, setProfiles] = useState<any[]>([]);
  const [oposiciones, setOposiciones] = useState<any[]>([]);
  const [userOpos, setUserOpos] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [routineAssignments, setRoutineAssignments] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", nombre: "", apellidos: "", sexo: "masculino" as "masculino" | "femenino" });
  const [search, setSearch] = useState("");
  const [routineDialog, setRoutineDialog] = useState<{ open: boolean; userId: string }>({ open: false, userId: "" });
  const [routineForm, setRoutineForm] = useState({ routine_id: "", fecha_inicio: "", fecha_fin: "" });

  // Editar perfil
  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ nombre: "", apellidos: "", email: "", telefono: "", sexo: "masculino" as "masculino" | "femenino" | "unisex", peso: "", altura: "", fecha_nacimiento: "" });
  const [newPassword, setNewPassword] = useState("");
  const [resettingPwd, setResettingPwd] = useState(false);

  // Confirmación desvincular oposición
  const [unlinkConfirm, setUnlinkConfirm] = useState<{ id: string; nombre: string } | null>(null);

  const load = async () => {
    const [p, o, uo, ca, r, ra, ur] = await Promise.all([
      supabase.from("profiles").select("*").order("nombre"),
      supabase.from("oposiciones").select("*"),
      supabase.from("user_oposiciones").select("*"),
      supabase.from("coach_assignments").select("*"),
      supabase.from("routines").select("*").eq("status", "activo"),
      supabase.from("routine_assignments").select("*"),
      supabase.from("user_roles").select("*"),
    ]);
    setProfiles(p.data ?? []); setOposiciones(o.data ?? []);
    setUserOpos(uo.data ?? []); setAssignments(ca.data ?? []);
    setRoutines(r.data ?? []); setRoutineAssignments(ra.data ?? []);
    setUserRoles(ur.data ?? []);
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

  const openEdit = (p: any) => {
    setEditing(p);
    setNewPassword("");
    setEditForm({
      nombre: p.nombre ?? "", apellidos: p.apellidos ?? "", email: p.email ?? "",
      telefono: p.telefono ?? "", sexo: (p.sexo ?? "masculino") as any,
      peso: p.peso?.toString() ?? "", altura: p.altura?.toString() ?? "",
      fecha_nacimiento: p.fecha_nacimiento ?? "",
    });
  };

  const resetPassword = async () => {
    if (!editing) return;
    if (!newPassword || newPassword.length < 6) return toast.error("Mínimo 6 caracteres");
    setResettingPwd(true);
    const { data, error } = await supabase.functions.invoke("admin-reset-password", {
      body: { user_id: editing.user_id, password: newPassword },
    });
    setResettingPwd(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? "Error");
    toast.success("Contraseña actualizada");
    setNewPassword("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase.from("profiles").update({
      nombre: editForm.nombre, apellidos: editForm.apellidos, email: editForm.email,
      telefono: editForm.telefono || null, sexo: editForm.sexo,
      peso: editForm.peso ? Number(editForm.peso) : null,
      altura: editForm.altura ? Number(editForm.altura) : null,
      fecha_nacimiento: editForm.fecha_nacimiento || null,
    }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Perfil actualizado");
    setEditing(null);
    load();
  };

  const setRole = async (userId: string, role: "usuario" | "entrenador" | "superadmin") => {
    if (!isSuper) return toast.error("Solo el superadmin puede cambiar roles");
    // Eliminar roles previos y poner solo el nuevo
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) return toast.error(error.message);
    toast.success(`Rol ${role} asignado`);
    load();
  };

  const linkOpo = async (userId: string, opoId: string) => {
    const { error } = await supabase.from("user_oposiciones").insert({ user_id: userId, oposicion_id: opoId });
    if (error) return toast.error(error.message);
    toast.success("Oposición vinculada"); load();
  };

  const confirmUnlinkOpo = async () => {
    if (!unlinkConfirm) return;
    const { error } = await supabase.from("user_oposiciones").delete().eq("id", unlinkConfirm.id);
    if (error) return toast.error(error.message);
    toast.success("Oposición desvinculada");
    setUnlinkConfirm(null);
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

  const rolesOf = (userId: string) => userRoles.filter(r => r.user_id === userId).map(r => r.role);

  const filtered = profiles.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return `${p.nombre} ${p.apellidos} ${p.email ?? ""}`.toLowerCase().includes(q);
  });

  return (
    <TooltipProvider>
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
                  <TableHead>Rol</TableHead>
                  <TableHead>Sexo</TableHead>
                  <TableHead>Oposiciones</TableHead>
                  <TableHead>Rutinas activas</TableHead>
                  <TableHead>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help underline decoration-dotted">Asignación</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        Vincula un deportista a ti como entrenador. Los entrenadores solo ven y gestionan datos (diario, simulacros, rutinas) de los deportistas que tienen asignados.
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const opos = userOpos.filter(uo => uo.user_id === p.user_id);
                  const userRoutinesList = routineAssignments.filter(ra => ra.user_id === p.user_id);
                  const mine = isMine(p.user_id);
                  const roles = rolesOf(p.user_id);
                  const mainRole = roles.includes("superadmin") ? "superadmin" : roles.includes("entrenador") ? "entrenador" : "usuario";
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nombre} {p.apellidos}</TableCell>
                      <TableCell className="text-sm">{p.email}</TableCell>
                      <TableCell>
                        {isSuper ? (
                          <Select value={mainRole} onValueChange={(v) => setRole(p.user_id, v as any)}>
                            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="usuario">Usuario</SelectItem>
                              <SelectItem value="entrenador">Entrenador</SelectItem>
                              <SelectItem value="superadmin">Superadmin</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={mainRole === "superadmin" ? "destructive" : mainRole === "entrenador" ? "default" : "secondary"}>
                            {mainRole}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell><Badge variant="outline">{p.sexo ?? "—"}</Badge></TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-wrap gap-1">
                          {opos.map((uo) => {
                            const o = oposiciones.find(x => x.id === uo.oposicion_id);
                            return o ? (
                              <Badge key={uo.id} variant="secondary" className="cursor-pointer" onClick={() => setUnlinkConfirm({ id: uo.id, nombre: o.nombre })} title="Click para quitar">
                                {o.nombre} ×
                              </Badge>
                            ) : null;
                          })}
                          {opos.length === 0 && "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-wrap gap-1">
                          {userRoutinesList.map((ra) => {
                            const r = routines.find(x => x.id === ra.routine_id);
                            return r ? (
                              <Badge key={ra.id} variant={ra.activa ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleRoutineActive(ra.id, ra.activa)} title="Click para activar/desactivar">
                                {r.nombre}
                              </Badge>
                            ) : null;
                          })}
                          {userRoutinesList.length === 0 && "—"}
                        </div>
                      </TableCell>
                      <TableCell>{mine ? <Badge>Asignado a ti</Badge> : <Badge variant="outline">—</Badge>}</TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        <Button variant="outline" size="sm" onClick={() => openEdit(p)} title="Editar perfil"><Pencil className="h-3 w-3" /></Button>
                        <Select onValueChange={(v) => linkOpo(p.user_id, v)}>
                          <SelectTrigger className="w-32 inline-flex"><SelectValue placeholder="+ Oposición" /></SelectTrigger>
                          <SelectContent>{oposiciones.map(o => <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={() => setRoutineDialog({ open: true, userId: p.user_id })}>+ Rutina</Button>
                        {mine ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => unassign(p.user_id)}><UserMinus className="h-3 w-3" /></Button>
                            </TooltipTrigger>
                            <TooltipContent>Desasignar de mí (dejaré de ver sus datos)</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => assignToCoach(p.user_id)}><UserCheck className="h-3 w-3" /></Button>
                            </TooltipTrigger>
                            <TooltipContent>Asignar a mí como entrenador</TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin resultados.</TableCell></TableRow>
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

        {/* Editar perfil */}
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Editar perfil</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Nombre</Label><Input value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} /></div>
                <div className="space-y-2"><Label>Apellidos</Label><Input value={editForm.apellidos} onChange={(e) => setEditForm({ ...editForm, apellidos: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Teléfono</Label><Input value={editForm.telefono} onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })} /></div>
                <div className="space-y-2"><Label>Sexo</Label>
                  <Select value={editForm.sexo} onValueChange={(v) => setEditForm({ ...editForm, sexo: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="femenino">Femenino</SelectItem>
                      <SelectItem value="unisex">Unisex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2"><Label>Peso (kg)</Label><Input type="number" step="0.1" value={editForm.peso} onChange={(e) => setEditForm({ ...editForm, peso: e.target.value })} /></div>
                <div className="space-y-2"><Label>Altura (cm)</Label><Input type="number" step="0.1" value={editForm.altura} onChange={(e) => setEditForm({ ...editForm, altura: e.target.value })} /></div>
                <div className="space-y-2"><Label>Nacimiento</Label><Input type="date" value={editForm.fecha_nacimiento} onChange={(e) => setEditForm({ ...editForm, fecha_nacimiento: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={saveEdit}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmación desvincular oposición */}
        <AlertDialog open={!!unlinkConfirm} onOpenChange={(o) => !o && setUnlinkConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Desvincular oposición?</AlertDialogTitle>
              <AlertDialogDescription>
                Vas a desvincular al deportista de la oposición <b>{unlinkConfirm?.nombre}</b>. Podrás volver a vincularlo cuando quieras.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmUnlinkOpo}>Desvincular</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
