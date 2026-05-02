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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Plus, Loader2, Search, Pencil, KeyRound, X } from "lucide-react";
import { toast } from "sonner";
import { FileUploader } from "@/components/FileUploader";

const initialsOf = (n?: string, a?: string) => `${(n ?? "").charAt(0)}${(a ?? "").charAt(0)}`.toUpperCase() || "?";

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
  const [form, setForm] = useState({
    email: "", password: "", nombre: "", apellidos: "",
    sexo: "masculino" as "masculino" | "femenino", fecha_nacimiento: "",
    peso: "", altura: "", avatar_url: "",
  });
  const [search, setSearch] = useState("");

  // Editar perfil (incluye rol, oposiciones y rutinas)
  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    nombre: "", apellidos: "", email: "", telefono: "",
    sexo: "masculino" as "masculino" | "femenino" | "unisex",
    peso: "", altura: "", fecha_nacimiento: "", avatar_url: "",
  });
  const [editRole, setEditRole] = useState<"usuario" | "entrenador" | "superadmin">("usuario");
  const [routineForm, setRoutineForm] = useState({ routine_id: "", fecha_inicio: "", fecha_fin: "" });
  const [linkOpoSel, setLinkOpoSel] = useState<string>("");
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
        fecha_nacimiento: form.fecha_nacimiento || null,
        peso: form.peso ? Number(form.peso) : null,
        altura: form.altura ? Number(form.altura) : null,
        avatar_url: form.avatar_url || null,
      },
    });
    setCreating(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error ?? error?.message ?? "Error");
    }
    toast.success("Deportista creado y asignado");
    setOpen(false);
    setForm({ email: "", password: "", nombre: "", apellidos: "", sexo: "masculino", fecha_nacimiento: "", peso: "", altura: "", avatar_url: "" });
    load();
  };

  const rolesOf = (userId: string) => userRoles.filter(r => r.user_id === userId).map(r => r.role);
  const mainRoleOf = (userId: string) => {
    const roles = rolesOf(userId);
    return roles.includes("superadmin") ? "superadmin" : roles.includes("entrenador") ? "entrenador" : "usuario";
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setNewPassword("");
    setLinkOpoSel("");
    setRoutineForm({ routine_id: "", fecha_inicio: "", fecha_fin: "" });
    setEditRole(mainRoleOf(p.user_id) as any);
    setEditForm({
      nombre: p.nombre ?? "", apellidos: p.apellidos ?? "", email: p.email ?? "",
      telefono: p.telefono ?? "", sexo: (p.sexo ?? "masculino") as any,
      peso: p.peso?.toString() ?? "", altura: p.altura?.toString() ?? "",
      fecha_nacimiento: p.fecha_nacimiento ?? "",
      avatar_url: p.avatar_url ?? "",
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
      avatar_url: editForm.avatar_url || null,
    }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    // Si superadmin y cambió rol, aplicar
    if (isSuper) {
      const current = mainRoleOf(editing.user_id);
      if (current !== editRole) {
        await supabase.from("user_roles").delete().eq("user_id", editing.user_id);
        await supabase.from("user_roles").insert({ user_id: editing.user_id, role: editRole });
      }
    }
    toast.success("Perfil actualizado");
    setEditing(null);
    load();
  };

  const linkOpoInModal = async () => {
    if (!editing || !linkOpoSel) return;
    const { error } = await supabase.from("user_oposiciones").insert({ user_id: editing.user_id, oposicion_id: linkOpoSel });
    if (error) return toast.error(error.message);
    toast.success("Oposición vinculada");
    setLinkOpoSel("");
    load();
  };

  const confirmUnlinkOpo = async () => {
    if (!unlinkConfirm) return;
    const { error } = await supabase.from("user_oposiciones").delete().eq("id", unlinkConfirm.id);
    if (error) return toast.error(error.message);
    toast.success("Oposición desvinculada");
    setUnlinkConfirm(null);
    load();
  };

  const assignRoutineInModal = async () => {
    if (!user || !editing || !routineForm.routine_id) return;
    const { error } = await supabase.from("routine_assignments").insert({
      user_id: editing.user_id,
      routine_id: routineForm.routine_id,
      assigned_by: user.id,
      fecha_inicio: routineForm.fecha_inicio || null,
      fecha_fin: routineForm.fecha_fin || null,
      activa: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Rutina asignada");
    setRoutineForm({ routine_id: "", fecha_inicio: "", fecha_fin: "" });
    load();
  };

  const toggleRoutineActive = async (id: string, activa: boolean) => {
    await supabase.from("routine_assignments").update({ activa: !activa }).eq("id", id);
    load();
  };

  const removeRoutineAssignment = async (id: string) => {
    await supabase.from("routine_assignments").delete().eq("id", id);
    load();
  };

  const filtered = profiles.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return `${p.nombre} ${p.apellidos} ${p.email ?? ""}`.toLowerCase().includes(q);
  });

  const editingOpos = editing ? userOpos.filter(uo => uo.user_id === editing.user_id) : [];
  const editingRoutines = editing ? routineAssignments.filter(ra => ra.user_id === editing.user_id) : [];

  return (
    <TooltipProvider>
      <div>
        <PageHeader title="Usuarios" description="Gestión de deportistas, asignaciones, oposiciones y rutinas."
          actions={
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Nuevo</Button></DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Nuevo deportista</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="flex flex-col items-center gap-2">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={form.avatar_url} />
                      <AvatarFallback>{initialsOf(form.nombre, form.apellidos)}</AvatarFallback>
                    </Avatar>
                    <FileUploader
                      folder="avatars/new"
                      value={form.avatar_url}
                      onChange={(url) => setForm({ ...form, avatar_url: url ?? "" })}
                      preview={false}
                    />
                  </div>
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
                  <div className="space-y-2"><Label>Fecha de nacimiento</Label><Input type="date" value={form.fecha_nacimiento} onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Peso (kg)</Label><Input type="number" step="0.1" value={form.peso} onChange={(e) => setForm({ ...form, peso: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Altura (cm)</Label><Input type="number" step="0.1" value={form.altura} onChange={(e) => setForm({ ...form, altura: e.target.value })} /></div>
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
                  <TableHead>Deportista</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Oposiciones</TableHead>
                  <TableHead>Rutinas activas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const opos = userOpos.filter(uo => uo.user_id === p.user_id);
                  const userRoutinesList = routineAssignments.filter(ra => ra.user_id === p.user_id && ra.activa);
                  const mainRole = mainRoleOf(p.user_id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={p.avatar_url ?? undefined} />
                            <AvatarFallback>{initialsOf(p.nombre, p.apellidos)}</AvatarFallback>
                          </Avatar>
                          <span>{p.nombre} {p.apellidos}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{p.email}</TableCell>
                      <TableCell>
                        <Badge variant={mainRole === "superadmin" ? "destructive" : mainRole === "entrenador" ? "default" : "secondary"}>
                          {mainRole}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-wrap gap-1">
                          {opos.map((uo) => {
                            const o = oposiciones.find(x => x.id === uo.oposicion_id);
                            return o ? <Badge key={uo.id} variant="secondary">{o.nombre}</Badge> : null;
                          })}
                          {opos.length === 0 && "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-wrap gap-1">
                          {userRoutinesList.map((ra) => {
                            const r = routines.find(x => x.id === ra.routine_id);
                            return r ? <Badge key={ra.id} variant="default">{r.nombre}</Badge> : null;
                          })}
                          {userRoutinesList.length === 0 && "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="outline" size="sm" onClick={() => openEdit(p)} title="Editar perfil">
                          <Pencil className="h-3 w-3 mr-1" /> Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin resultados.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Editar perfil */}
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Editar perfil</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-2">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={editForm.avatar_url} />
                  <AvatarFallback>{initialsOf(editForm.nombre, editForm.apellidos)}</AvatarFallback>
                </Avatar>
                <FileUploader
                  folder={`avatars/${editing?.user_id ?? "edit"}`}
                  value={editForm.avatar_url}
                  onChange={(url) => setEditForm({ ...editForm, avatar_url: url ?? "" })}
                  preview={false}
                />
              </div>

              {/* Datos */}
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

              {/* Rol */}
              {isSuper && (
                <div className="border-t pt-3 space-y-2">
                  <Label>Rol</Label>
                  <Select value={editRole} onValueChange={(v) => setEditRole(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usuario">Usuario</SelectItem>
                      <SelectItem value="entrenador">Entrenador</SelectItem>
                      <SelectItem value="superadmin">Superadmin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Oposiciones */}
              <div className="border-t pt-3 space-y-2">
                <Label>Oposiciones</Label>
                <div className="flex flex-wrap gap-1 min-h-[2rem]">
                  {editingOpos.map((uo) => {
                    const o = oposiciones.find(x => x.id === uo.oposicion_id);
                    return o ? (
                      <Badge key={uo.id} variant="secondary" className="gap-1">
                        {o.nombre}
                        <button
                          type="button"
                          className="hover:text-destructive"
                          onClick={() => setUnlinkConfirm({ id: uo.id, nombre: o.nombre })}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                  {editingOpos.length === 0 && <span className="text-xs text-muted-foreground">Sin oposiciones</span>}
                </div>
                <div className="flex gap-2">
                  <Select value={linkOpoSel} onValueChange={setLinkOpoSel}>
                    <SelectTrigger><SelectValue placeholder="Añadir oposición..." /></SelectTrigger>
                    <SelectContent>
                      {oposiciones
                        .filter(o => !editingOpos.some(uo => uo.oposicion_id === o.id))
                        .map(o => <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={linkOpoInModal} disabled={!linkOpoSel}>Vincular</Button>
                </div>
              </div>

              {/* Rutinas */}
              <div className="border-t pt-3 space-y-2">
                <Label>Rutinas asignadas</Label>
                <div className="space-y-1">
                  {editingRoutines.map((ra) => {
                    const r = routines.find(x => x.id === ra.routine_id);
                    if (!r) return null;
                    return (
                      <div key={ra.id} className="flex items-center gap-2 text-sm border rounded-md px-2 py-1">
                        <span className="flex-1">{r.nombre} <span className="text-xs text-muted-foreground">({r.num_dias}d)</span></span>
                        <Badge variant={ra.activa ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleRoutineActive(ra.id, ra.activa)}>
                          {ra.activa ? "Activa" : "Inactiva"}
                        </Badge>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeRoutineAssignment(ra.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                  {editingRoutines.length === 0 && <span className="text-xs text-muted-foreground">Sin rutinas</span>}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={routineForm.routine_id} onValueChange={(v) => setRoutineForm({ ...routineForm, routine_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Rutina..." /></SelectTrigger>
                    <SelectContent>{routines.map(r => <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="date" placeholder="Inicio" value={routineForm.fecha_inicio} onChange={(e) => setRoutineForm({ ...routineForm, fecha_inicio: e.target.value })} />
                  <Input type="date" placeholder="Fin" value={routineForm.fecha_fin} onChange={(e) => setRoutineForm({ ...routineForm, fecha_fin: e.target.value })} />
                </div>
                <Button variant="outline" size="sm" onClick={assignRoutineInModal} disabled={!routineForm.routine_id}>
                  Asignar rutina
                </Button>
              </div>

              {/* Reset password */}
              {isSuper && (
                <div className="border-t pt-3 space-y-2">
                  <Label className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Resetear contraseña</Label>
                  <div className="flex gap-2">
                    <Input type="password" placeholder="Nueva contraseña (mín. 6)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    <Button variant="outline" onClick={resetPassword} disabled={resettingPwd || !newPassword}>
                      {resettingPwd && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Asignar
                    </Button>
                  </div>
                </div>
              )}
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
