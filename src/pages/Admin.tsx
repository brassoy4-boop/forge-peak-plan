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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, ShieldAlert } from "lucide-react";

export default function Admin() {
  const { user } = useAuth();
  const [pin, setPin] = useState("");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [newRole, setNewRole] = useState<Record<string, string>>({});

  const load = async () => {
    const [s, p, r] = await Promise.all([
      supabase.from("app_settings").select("*").eq("key", "access_pin").maybeSingle(),
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
    ]);
    setPin(s.data?.value ?? "");
    setProfiles(p.data ?? []); setRoles(r.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const savePin = async () => {
    const { error } = await supabase.from("app_settings").update({ value: pin }).eq("key", "access_pin");
    if (error) return toast.error(error.message);
    toast.success("PIN actualizado");
  };

  const assignRole = async (userId: string, role: string) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
    if (error) return toast.error(error.message);
    toast.success("Rol asignado"); load();
  };

  const removeRole = async (id: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div>
      <PageHeader title="Configuración" description="PIN global, roles y permisos." />
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
      </div>
      <Card>
        <CardHeader><CardTitle>Roles y permisos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Email</TableHead><TableHead>Roles</TableHead><TableHead className="text-right">Asignar</TableHead></TableRow></TableHeader>
            <TableBody>
              {profiles.map(p => {
                const r = roles.filter(x => x.user_id === p.user_id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nombre} {p.apellidos}</TableCell>
                    <TableCell className="text-sm">{p.email}</TableCell>
                    <TableCell className="space-x-1">
                      {r.map(x => (
                        <Badge key={x.id} variant={x.role === "superadmin" ? "destructive" : x.role === "entrenador" ? "default" : "secondary"} className="cursor-pointer" onClick={() => removeRole(x.id)} title="Click para quitar">
                          {x.role}
                        </Badge>
                      ))}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Select value={newRole[p.user_id] ?? ""} onValueChange={(v) => setNewRole({ ...newRole, [p.user_id]: v })}>
                          <SelectTrigger className="w-32"><SelectValue placeholder="Rol..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="usuario">usuario</SelectItem>
                            <SelectItem value="entrenador">entrenador</SelectItem>
                            <SelectItem value="superadmin">superadmin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" disabled={!newRole[p.user_id]} onClick={() => assignRole(p.user_id, newRole[p.user_id])}>+</Button>
                      </div>
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
