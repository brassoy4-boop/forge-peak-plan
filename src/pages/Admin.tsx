import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Save, ShieldAlert, Plus, Loader2 } from "lucide-react";

export default function Admin() {
  const [pin, setPin] = useState("");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [openCoach, setOpenCoach] = useState(false);
  const [coachForm, setCoachForm] = useState({ email: "", password: "", nombre: "", apellidos: "" });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const [s, p, r] = await Promise.all([
      supabase.from("app_settings").select("*").eq("key", "access_pin").maybeSingle(),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
    ]);
    setPin(s.data?.value ?? "");
    setProfiles(p.data ?? []); setRoles(r.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const savePin = async () => {
    const { data, error } = await supabase.rpc("set_access_pin", { _pin: pin });
    if (error || !data) return toast.error(error?.message ?? "No se pudo actualizar");
    toast.success("PIN actualizado");
  };

  const setRole = async (userId: string, role: "usuario" | "entrenador" | "superadmin") => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) return toast.error(error.message);
    toast.success(`Rol ${role} asignado`); load();
  };

  const createCoach = async () => {
    if (!coachForm.email || !coachForm.password) return toast.error("Email y contraseña requeridos");
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: {
        email: coachForm.email, password: coachForm.password,
        nombre: coachForm.nombre, apellidos: coachForm.apellidos, role: "entrenador",
      },
    });
    setCreating(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? "Error");
    toast.success("Entrenador creado");
    setOpenCoach(false);
    setCoachForm({ email: "", password: "", nombre: "", apellidos: "" });
    load();
  };

  const mainRoleOf = (uid: string) => {
    const list = roles.filter((x) => x.user_id === uid).map((x) => x.role);
    if (list.includes("superadmin")) return "superadmin";
    if (list.includes("entrenador")) return "entrenador";
    return "usuario";
  };

  return (
    <div>
      <PageHeader title="Configuración" description="PIN global, entrenadores, roles y permisos." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" /> PIN de acceso</CardTitle>
            <CardDescription>El PIN se solicita después de email + contraseña en cada inicio de sesión.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2"><Label>PIN actual</Label><Input value={pin} onChange={(e) => setPin(e.target.value)} /></div>
            <Button onClick={savePin}><Save className="mr-2 h-4 w-4" /> Guardar PIN</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Entrenadores</CardTitle>
            <CardDescription>Solo el superadmin puede crear cuentas de entrenador.</CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={openCoach} onOpenChange={setOpenCoach}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Nuevo entrenador</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Crear entrenador</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Nombre</Label><Input value={coachForm.nombre} onChange={(e) => setCoachForm({ ...coachForm, nombre: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Apellidos</Label><Input value={coachForm.apellidos} onChange={(e) => setCoachForm({ ...coachForm, apellidos: e.target.value })} /></div>
                  </div>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" value={coachForm.email} onChange={(e) => setCoachForm({ ...coachForm, email: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Contraseña temporal</Label><Input type="password" value={coachForm.password} onChange={(e) => setCoachForm({ ...coachForm, password: e.target.value })} /></div>
                </div>
                <DialogFooter>
                  <Button onClick={createCoach} disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Crear entrenador
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Roles y permisos</CardTitle>
          <CardDescription>Cada usuario solo puede tener un rol. Cámbialo desde el selector.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Email</TableHead><TableHead>Rol</TableHead></TableRow></TableHeader>
            <TableBody>
              {profiles.map((p) => {
                const role = mainRoleOf(p.user_id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nombre} {p.apellidos}</TableCell>
                    <TableCell className="text-sm">{p.email}</TableCell>
                    <TableCell>
                      <Select value={role} onValueChange={(v) => setRole(p.user_id, v as any)}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="usuario">Usuario</SelectItem>
                          <SelectItem value="entrenador">Entrenador</SelectItem>
                          <SelectItem value="superadmin">Superadmin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
