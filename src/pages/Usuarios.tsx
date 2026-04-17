import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, UserCheck } from "lucide-react";
import { toast } from "sonner";

export default function Usuarios() {
  const { user, primaryRole } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [oposiciones, setOposiciones] = useState<any[]>([]);
  const [userOpos, setUserOpos] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", nombre: "", apellidos: "", sexo: "masculino" });

  const load = async () => {
    const [p, o, uo] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("oposiciones").select("*"),
      supabase.from("user_oposiciones").select("*"),
    ]);
    setProfiles(p.data ?? []); setOposiciones(o.data ?? []); setUserOpos(uo.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.email || !form.password) return toast.error("Email y contraseña requeridos");
    // Crear usuario con signUp (los signups normales están desactivados,
    // así que usamos admin via edge function en producción; en MVP usamos signUp temporal).
    const { error } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: { data: { nombre: form.nombre, apellidos: form.apellidos } },
    });
    if (error) return toast.error("No se pudo crear: " + error.message);
    toast.success("Usuario creado"); setOpen(false); load();
  };

  const assignToCoach = async (userId: string) => {
    if (!user) return;
    const { error } = await supabase.from("coach_assignments").insert({ coach_id: user.id, user_id: userId });
    if (error) return toast.error(error.message);
    toast.success("Asignado a ti");
  };

  const linkOpo = async (userId: string, opoId: string) => {
    const { error } = await supabase.from("user_oposiciones").insert({ user_id: userId, oposicion_id: opoId });
    if (error) return toast.error(error.message);
    toast.success("Oposición vinculada"); load();
  };

  return (
    <div>
      <PageHeader title="Usuarios" description="Gestión de deportistas y asignaciones."
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
                <div className="space-y-2"><Label>Contraseña</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
                <div className="space-y-2"><Label>Sexo</Label>
                  <Select value={form.sexo} onValueChange={(v) => setForm({ ...form, sexo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem><SelectItem value="femenino">Femenino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">El usuario podrá iniciar sesión con email + contraseña + PIN del centro.</p>
              </div>
              <DialogFooter><Button onClick={create}>Crear</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Email</TableHead><TableHead>Sexo</TableHead><TableHead>Oposiciones</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {profiles.map((p) => {
                const opos = userOpos.filter(uo => uo.user_id === p.user_id).map(uo => oposiciones.find(o => o.id === uo.oposicion_id)?.nombre).filter(Boolean);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nombre} {p.apellidos}</TableCell>
                    <TableCell className="text-sm">{p.email}</TableCell>
                    <TableCell><Badge variant="outline">{p.sexo ?? "—"}</Badge></TableCell>
                    <TableCell className="text-xs">{opos.join(", ") || "—"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Select onValueChange={(v) => linkOpo(p.user_id, v)}>
                        <SelectTrigger className="w-36 inline-flex"><SelectValue placeholder="+ Oposición" /></SelectTrigger>
                        <SelectContent>{oposiciones.map(o => <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" onClick={() => assignToCoach(p.user_id)}><UserCheck className="h-3 w-3" /></Button>
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
