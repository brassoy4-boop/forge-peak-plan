import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy, Dumbbell, BookOpen, Activity, Users, Target } from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { primaryRole, user } = useAuth();
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      if (primaryRole === "usuario") {
        const [opos, rutinas, simulacros, marcas] = await Promise.all([
          supabase.from("user_oposiciones").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("routine_assignments").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("activa", true),
          supabase.from("simulacro_executions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("mark_records").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        ]);
        setStats({
          oposiciones: opos.count ?? 0,
          rutinas: rutinas.count ?? 0,
          simulacros: simulacros.count ?? 0,
          marcas: marcas.count ?? 0,
        });
      } else {
        const [usuarios, opos, simulacros, ejercicios] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("oposiciones").select("id", { count: "exact", head: true }),
          supabase.from("simulacro_templates").select("id", { count: "exact", head: true }),
          supabase.from("exercises").select("id", { count: "exact", head: true }),
        ]);
        setStats({
          usuarios: usuarios.count ?? 0,
          oposiciones: opos.count ?? 0,
          simulacros: simulacros.count ?? 0,
          ejercicios: ejercicios.count ?? 0,
        });
      }
    };
    load();
  }, [user, primaryRole]);

  const userCards = [
    { key: "oposiciones", label: "Oposiciones", icon: Trophy, to: "/app/oposiciones" },
    { key: "rutinas", label: "Rutinas activas", icon: Dumbbell, to: "/app/rutinas" },
    { key: "simulacros", label: "Simulacros", icon: Target, to: "/app/simulacros" },
    { key: "marcas", label: "Marcas registradas", icon: Activity, to: "/app/evolucion" },
  ];
  const coachCards = [
    { key: "usuarios", label: "Deportistas", icon: Users, to: "/app/usuarios" },
    { key: "oposiciones", label: "Oposiciones", icon: Trophy, to: "/app/oposiciones" },
    { key: "simulacros", label: "Simulacros", icon: Target, to: "/app/simulacros" },
    { key: "ejercicios", label: "Ejercicios", icon: Dumbbell, to: "/app/ejercicios" },
  ];
  const cards = primaryRole === "usuario" ? userCards : coachCards;

  return (
    <div>
      <PageHeader
        title={primaryRole === "usuario" ? "Mi panel" : primaryRole === "entrenador" ? "Panel entrenador" : "Panel superadmin"}
        description="Resumen de actividad de Corpore10."
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.key} to={c.to}>
            <Card className="hover:border-primary transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{c.label}</CardTitle>
                <c.icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="brand-title text-4xl text-primary">{stats[c.key] ?? 0}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="brand-title">Bienvenido a Corpore10</CardTitle>
          <CardDescription>
            {primaryRole === "usuario"
              ? "Consulta tus oposiciones, rutinas y registra tu diario diario para hacer seguimiento de tu progreso."
              : "Gestiona deportistas, rutinas, simulacros y carga masiva de marcas desde el menú lateral."}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
