// Edge function: importa un lote de ejercicios al bucket attachments + tabla exercises.
// Usa SERVICE_ROLE para saltarse RLS y subir al storage.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REMOTE_BASE = "https://app.corpore10trainer.com/storage/app/public/";
const BUCKET = "attachments";

interface Item {
  nombre: string;
  category_id: string | null;
  image_path: string | null; // ej: "exercises\\February2023\\1.jpg"
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, key, { auth: { persistSession: false } });

    const body = await req.json();
    const items: Item[] = body.items || [];
    const skipExisting: boolean = body.skipExisting !== false;

    // Set de existentes (en este lote, para evitar duplicados internos)
    let existing = new Set<string>();
    if (skipExisting && items.length) {
      const names = items.map(i => i.nombre);
      const { data } = await sb
        .from("exercises")
        .select("nombre")
        .in("nombre", names);
      existing = new Set((data || []).map((r: any) => r.nombre.toLowerCase()));
    }

    const stats = { inserted: 0, skipped_dup: 0, no_image: 0, img_failed: 0, errors: 0 };
    const errors: string[] = [];

    // Procesa con concurrencia 6
    const queue = [...items];
    async function worker() {
      while (queue.length) {
        const it = queue.shift();
        if (!it) return;
        if (existing.has(it.nombre.toLowerCase())) { stats.skipped_dup++; continue; }

        let imagen_url: string | null = null;
        if (it.image_path) {
          const norm = it.image_path.replace(/\\/g, "/");
          const remote = REMOTE_BASE + norm;
          try {
            const r = await fetch(remote);
            if (!r.ok) {
              stats.img_failed++;
            } else {
              const buf = new Uint8Array(await r.arrayBuffer());
              const ct = r.headers.get("content-type") || "image/jpeg";
              const { error: upErr } = await sb.storage
                .from(BUCKET)
                .upload(norm, buf, { contentType: ct, upsert: true });
              if (upErr) {
                stats.img_failed++;
                errors.push(`upload ${norm}: ${upErr.message}`);
              } else {
                imagen_url = sb.storage.from(BUCKET).getPublicUrl(norm).data.publicUrl;
              }
            }
          } catch (e) {
            stats.img_failed++;
            errors.push(`fetch ${norm}: ${(e as Error).message}`);
          }
        } else {
          stats.no_image++;
        }

        const { error } = await sb.from("exercises").insert({
          nombre: it.nombre,
          category_id: it.category_id,
          imagen_url,
        });
        if (error) {
          stats.errors++;
          errors.push(`insert ${it.nombre}: ${error.message}`);
        } else {
          stats.inserted++;
          existing.add(it.nombre.toLowerCase());
        }
      }
    }
    await Promise.all(Array.from({ length: 6 }, worker));

    return new Response(JSON.stringify({ stats, errors: errors.slice(0, 20) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
