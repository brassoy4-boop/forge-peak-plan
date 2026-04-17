import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brand } from "@/components/Brand";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function ResetPassword() {
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase recovery: el enlace deja sesión PASSWORD_RECOVERY
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 6) return toast.error("Mínimo 6 caracteres");
    if (pwd !== pwd2) return toast.error("Las contraseñas no coinciden");
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Contraseña actualizada. Inicia sesión.");
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center"><Brand size="xl" className="text-white" /></div>
        <Card>
          <CardHeader>
            <CardTitle>Nueva contraseña</CardTitle>
            <CardDescription>Introduce tu nueva contraseña para recuperar el acceso.</CardDescription>
          </CardHeader>
          <CardContent>
            {!ready ? (
              <p className="text-sm text-muted-foreground">Validando enlace...</p>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2"><Label>Nueva contraseña</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} required minLength={6} /></div>
                <div className="space-y-2"><Label>Repetir</Label><Input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} required /></div>
                <Button className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Actualizar
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
