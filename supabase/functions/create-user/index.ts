// Edge function: crea un usuario (auth + perfil + rol) usando service role.
// Solo invocable por entrenador o superadmin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  email: string;
  password: string;
  nombre?: string;
  apellidos?: string;
  sexo?: "masculino" | "femenino" | "unisex" | null;
  role?: "usuario" | "entrenador";
  assign_to_caller?: boolean;
  fecha_nacimiento?: string | null;
  peso?: number | null;
  altura?: number | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(
      token,
    );
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Comprobar permisos
    const { data: rolesData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const roles = (rolesData ?? []).map((r) => r.role);
    const isCoach = roles.includes("entrenador");
    const isSuper = roles.includes("superadmin");
    if (!isCoach && !isSuper) {
      return new Response(JSON.stringify({ error: "Permisos insuficientes" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: Body = await req.json();
    if (!body.email || !body.password) {
      return new Response(
        JSON.stringify({ error: "email y password requeridos" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const wantsTrainer = body.role === "entrenador";
    if (wantsTrainer && !isSuper) {
      return new Response(
        JSON.stringify({
          error: "Solo el superadmin puede crear entrenadores",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Crear usuario auth
    const { data: created, error: createErr } = await admin.auth.admin
      .createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: {
          nombre: body.nombre ?? "",
          apellidos: body.apellidos ?? "",
        },
      });
    if (createErr || !created.user) {
      return new Response(
        JSON.stringify({ error: createErr?.message ?? "Error creando" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const newUserId = created.user.id;

    // Esperar a que el trigger handle_new_user cree perfil/rol y actualizar perfil con sexo
    if (body.sexo) {
      await admin.from("profiles").update({ sexo: body.sexo }).eq(
        "user_id",
        newUserId,
      );
    }

    // Si rol entrenador, añadirlo (manteniendo el rol 'usuario' por defecto si quieres limpiarlo, lo dejamos)
    if (wantsTrainer) {
      await admin.from("user_roles").delete().eq("user_id", newUserId).eq(
        "role",
        "usuario",
      );
      await admin.from("user_roles").insert({
        user_id: newUserId,
        role: "entrenador",
      });
    }

    // Asignar al coach actual si aplica
    if (body.assign_to_caller && isCoach && !wantsTrainer) {
      await admin.from("coach_assignments").insert({
        coach_id: callerId,
        user_id: newUserId,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, user_id: newUserId }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
