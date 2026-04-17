import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploader } from "@/components/FileUploader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

export default function Perfil() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    nombre: "", apellidos: "", telefono: "", fecha_nacimiento: "",
    sexo: "", peso: "", altura: "", avatar_url: "",
  });
  const [pwd, setPwd] = useState({ a: "", b: "" });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setForm({
        nombre: data.nombre ?? "",
        apellidos: data.apellidos ?? "",
        telefono: data.telefono ?? "",
        fecha_nacimiento: data.fecha_nacimiento ?? "",
        sexo: data.sexo ?? "",
        peso: data.peso?.toString() ?? "",
        altura: data.altura?.toString() ?? "",
        avatar_url: (data as any).avatar_url ?? "",
      });
      setLoading(false);
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      nombre: form.nombre.trim(),
      apellidos: form.apellidos.trim(),
      telefono: form.telefono.trim() || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      sexo: form.sexo || null,
      peso: form.peso ? Number(form.peso) : null,
      altura: form.altura ? Number(form.altura) : null,
      avatar_url: form.avatar_url || null,
    } as any).eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Perfil actualizado");
  };

  const changePwd = async () => {
    if (!pwd.a || pwd.a.length < 6) return toast.error("Contraseña demasiado corta");
    if (pwd.a !== pwd.b) return toast.error("Las contraseñas no coinciden");
    const { error } = await supabase.auth.updateUser({ password: pwd.a });
    if (error) toast.error(error.message);
    else { toast.success("Contraseña actualizada"); setPwd({ a: "", b: "" }); }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const initials = `${form.nombre?.[0] ?? ""}${form.apellidos?.[0] ?? ""}`.toUpperCase() || "U";

  return (
    <div>
      <PageHeader title="Mi perfil" description="Datos personales, foto y contraseña." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Datos personales</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nombre</Label><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
              <div className="space-y-2"><Label>Apellidos</Label><Input value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} /></div>
              <div className="space-y-2"><Label>Teléfono</Label><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
              <div className="space-y-2"><Label>Fecha de nacimiento</Label><Input type="date" value={form.fecha_nacimiento} onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} /></div>
              <div className="space-y-2"><Label>Sexo</Label>
                <Select value={form.sexo} onValueChange={(v) => setForm({ ...form, sexo: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="femenino">Femenino</SelectItem>
                    <SelectItem value="unisex">Otro / Prefiero no decir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Peso (kg)</Label><Input type="number" step="0.1" value={form.peso} onChange={(e) => setForm({ ...form, peso: e.target.value })} /></div>
                <div className="space-y-2"><Label>Altura (cm)</Label><Input type="number" value={form.altura} onChange={(e) => setForm({ ...form, altura: e.target.value })} /></div>
              </div>
            </div>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar cambios
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Foto de perfil</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={form.avatar_url} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </div>
              <FileUploader
                folder={`avatars/${user?.id}`}
                value={form.avatar_url}
                onChange={(url) => { setForm({ ...form, avatar_url: url ?? "" }); }}
                preview={false}
              />
              <Button size="sm" variant="outline" onClick={save} className="w-full">Guardar foto</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Cambiar contraseña</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2"><Label>Nueva contraseña</Label><Input type="password" value={pwd.a} onChange={(e) => setPwd({ ...pwd, a: e.target.value })} /></div>
              <div className="space-y-2"><Label>Repetir</Label><Input type="password" value={pwd.b} onChange={(e) => setPwd({ ...pwd, b: e.target.value })} /></div>
              <Button onClick={changePwd} variant="outline" className="w-full">Actualizar contraseña</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
