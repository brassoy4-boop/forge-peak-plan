import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brand } from "@/components/Brand";
import { useAuth, PIN_STORAGE_KEY } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

type Step = "credentials" | "pin" | "bootstrap";

export default function AuthPage() {
  const navigate = useNavigate();
  const { session, loading, refreshRoles } = useAuth();
  const [step, setStep] = useState<Step>("credentials");
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Comprobar si existe superadmin → si no, mostrar asistente
  useEffect(() => {
    supabase.rpc("superadmin_exists").then(({ data }) => {
      if (data === false) {
        setNeedsBootstrap(true);
        setStep("bootstrap");
      }
    });
  }, []);

  useEffect(() => {
    if (!loading && session && sessionStorage.getItem(PIN_STORAGE_KEY) === "1") {
      navigate("/app", { replace: true });
    } else if (!loading && session && step !== "bootstrap") {
      setStep("pin");
    }
  }, [session, loading, navigate, step]);

  const onSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (error) {
      toast.error("Credenciales incorrectas");
      return;
    }
    setStep("pin");
  };

  const onSubmitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { data, error } = await supabase.rpc("verify_access_pin", { _pin: pin });
    setSubmitting(false);
    if (error || !data) {
      toast.error("PIN incorrecto");
      return;
    }
    sessionStorage.setItem(PIN_STORAGE_KEY, "1");
    toast.success("Acceso concedido");
    navigate("/app", { replace: true });
  };

  const onBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // 1. Crear cuenta
    const { error: signErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { nombre, apellidos },
      },
    });
    if (signErr) {
      setSubmitting(false);
      toast.error("No se pudo crear la cuenta: " + signErr.message);
      return;
    }
    // 2. Iniciar sesión (por si email_confirm está activo, intenta login directo)
    await supabase.auth.signInWithPassword({ email: email.trim(), password });
    // 3. Promocionar
    const { data: ok, error: promErr } = await supabase.rpc("promote_to_superadmin");
    setSubmitting(false);
    if (promErr || !ok) {
      toast.error("No se pudo promocionar a superadmin. Verifica el correo si es necesario.");
      return;
    }
    toast.success("Superadmin creado. Introduce el PIN.");
    await refreshRoles();
    setNeedsBootstrap(false);
    setStep("pin");
  };

  return (
    <div className="min-h-screen flex flex-col bg-secondary text-secondary-foreground">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <Brand size="xl" className="text-white" />
            <p className="text-sm uppercase tracking-[0.3em] text-white/60">
              Preparación física · Oposiciones
            </p>
          </div>

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="brand-title text-2xl flex items-center gap-2">
                {step === "bootstrap" && <ShieldCheck className="h-6 w-6 text-primary" />}
                {step === "credentials" && "Acceso al sistema"}
                {step === "pin" && "Verificación PIN"}
                {step === "bootstrap" && "Crear superadmin inicial"}
              </CardTitle>
              <CardDescription>
                {step === "credentials" && "Introduce tus credenciales de Corpore10."}
                {step === "pin" && "Introduce el PIN de acceso del centro."}
                {step === "bootstrap" && "No hay ningún superadmin todavía. Crea el primero ahora."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {step === "credentials" && (
                <form onSubmit={onSubmitCredentials} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Continuar
                  </Button>
                  {needsBootstrap && (
                    <Button type="button" variant="outline" className="w-full" onClick={() => setStep("bootstrap")}>
                      Crear superadmin inicial
                    </Button>
                  )}
                </form>
              )}

              {step === "pin" && (
                <form onSubmit={onSubmitPin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pin">PIN de acceso</Label>
                    <Input id="pin" inputMode="numeric" maxLength={10} required value={pin} onChange={(e) => setPin(e.target.value)} autoFocus />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Entrar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      setStep("credentials");
                      setPin("");
                    }}
                  >
                    Cancelar
                  </Button>
                </form>
              )}

              {step === "bootstrap" && (
                <form onSubmit={onBootstrap} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Nombre</Label>
                      <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Apellidos</Label>
                      <Input value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Contraseña</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Crear superadmin
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Tras crear la cuenta, introducirás el PIN del centro (por defecto <strong>942</strong>).
                  </p>
                </form>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-xs text-white/50">
            Sólo personal autorizado. Las cuentas se crean desde el panel del superadmin.
          </p>
        </div>
      </div>
    </div>
  );
}
