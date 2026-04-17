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
import { Loader2 } from "lucide-react";

type Step = "credentials" | "pin";

export default function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session && sessionStorage.getItem(PIN_STORAGE_KEY) === "1") {
      navigate("/app", { replace: true });
    } else if (!loading && session) {
      setStep("pin");
    }
  }, [session, loading, navigate]);

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
              <CardTitle className="brand-title text-2xl">
                {step === "credentials" ? "Acceso al sistema" : "Verificación PIN"}
              </CardTitle>
              <CardDescription>
                {step === "credentials"
                  ? "Introduce tus credenciales de Corpore10."
                  : "Introduce el PIN de acceso del centro."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {step === "credentials" ? (
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
                </form>
              ) : (
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
