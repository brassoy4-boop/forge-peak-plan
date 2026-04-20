import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brand } from "@/components/Brand";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

type Step = "credentials" | "signup" | "bootstrap" | "forgot";

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

  // Si ya hay sesión activa, ir directo a la app
  useEffect(() => {
    if (!loading && session && step !== "bootstrap") {
      navigate("/app", { replace: true });
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
    toast.success("Acceso concedido");
    navigate("/app", { replace: true });
  };

  const onSubmitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // 1. Validar PIN del centro contra app_settings (RPC verify_access_pin)
    const { data: pinOk, error: pinErr } = await supabase.rpc("verify_access_pin", { _pin: pin });
    if (pinErr || !pinOk) {
      setSubmitting(false);
      toast.error("PIN del centro incorrecto");
      return;
    }

    // 2. Crear cuenta
    const { error: signErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { nombre, apellidos },
      },
    });
    if (signErr) {
      setSubmitting(false);
      toast.error("No se pudo crear la cuenta: " + signErr.message);
      return;
    }

    // 3. Intentar login directo (si auto-confirm está activo)
    const { error: loginErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (loginErr) {
      toast.success("Cuenta creada. Revisa tu email para confirmarla antes de entrar.");
      setStep("credentials");
      return;
    }
    toast.success("Cuenta creada. Bienvenido a Corpore10.");
    navigate("/app", { replace: true });
  };

  const onForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return toast.error("Indica tu email");
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Te hemos enviado un enlace de recuperación.");
    setStep("credentials");
  };

  const onBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error: signErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { nombre, apellidos },
      },
    });
    if (signErr && !signErr.message.toLowerCase().includes("already")) {
      setSubmitting(false);
      toast.error("No se pudo crear la cuenta: " + signErr.message);
      return;
    }
    const { error: loginErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (loginErr) {
      setSubmitting(false);
      toast.info("Revisa tu email para confirmar la cuenta y vuelve a esta pantalla. Tras confirmar, pulsa de nuevo 'Crear superadmin' con los mismos datos.");
      return;
    }
    const { data: ok, error: promErr } = await supabase.rpc("promote_to_superadmin");
    setSubmitting(false);
    if (promErr || !ok) {
      toast.error("No se pudo promocionar a superadmin. Es posible que ya exista uno.");
      return;
    }
    toast.success("Superadmin creado correctamente.");
    await refreshRoles();
    setNeedsBootstrap(false);
    navigate("/app", { replace: true });
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
                {step === "signup" && "Crear cuenta"}
                {step === "bootstrap" && "Crear superadmin inicial"}
                {step === "forgot" && "Recuperar contraseña"}
              </CardTitle>
              <CardDescription>
                {step === "credentials" && "Introduce tus credenciales de Corpore10."}
                {step === "signup" && "Necesitas el PIN del centro para registrarte."}
                {step === "bootstrap" && "No hay ningún superadmin todavía. Crea el primero ahora."}
                {step === "forgot" && "Te enviaremos un enlace por email para restablecerla."}
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
                    Entrar
                  </Button>
                  <div className="flex items-center justify-between text-xs">
                    <Button type="button" variant="link" className="px-0" onClick={() => setStep("forgot")}>
                      He olvidado mi contraseña
                    </Button>
                    <Button type="button" variant="link" className="px-0" onClick={() => setStep("signup")}>
                      Crear cuenta
                    </Button>
                  </div>
                  {needsBootstrap && (
                    <Button type="button" variant="outline" className="w-full" onClick={() => setStep("bootstrap")}>
                      Crear superadmin inicial
                    </Button>
                  )}
                </form>
              )}

              {step === "signup" && (
                <form onSubmit={onSubmitSignup} className="space-y-4">
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
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Contraseña</Label>
                    <Input id="signup-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-pin">PIN del centro</Label>
                    <Input
                      id="signup-pin"
                      inputMode="numeric"
                      maxLength={10}
                      required
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="Solicítalo a tu entrenador"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Crear cuenta
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("credentials")}>
                    Volver al acceso
                  </Button>
                </form>
              )}

              {step === "forgot" && (
                <form onSubmit={onForgot} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-r">Email</Label>
                    <Input id="email-r" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enviar enlace
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("credentials")}>
                    Volver
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
                </form>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-xs text-white/50">
            Sólo personal autorizado. Para registrarte necesitas el PIN del centro.
          </p>
        </div>
      </div>
    </div>
  );
}
