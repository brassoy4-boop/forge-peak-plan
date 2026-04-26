// Migrate exercise images from old Supabase project to current attachments bucket.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OLD_PREFIX = "https://kizljgzylehmqnmwdaqp.supabase.co/storage/v1/object/public/attachments/";
const BUCKET = "attachments";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const body = await req.json().catch(() => ({}));
    const limit = Number(body.limit ?? 200);

    const { data: rows, error } = await sb
      .from("exercises")
      .select("id, imagen_url")
      .like("imagen_url", `${OLD_PREFIX}%`)
      .limit(limit);

    if (error) throw error;

    const stats = { processed: 0, migrated: 0, failed: 0, remaining_after: 0 };
    const errors: string[] = [];

    const queue = [...(rows ?? [])];
    async function worker() {
      while (queue.length) {
        const r = queue.shift();
        if (!r) return;
        stats.processed++;
        const path = r.imagen_url!.substring(OLD_PREFIX.length); // exercises/February2023/1.jpg
        try {
          const resp = await fetch(r.imagen_url!);
          if (!resp.ok) { stats.failed++; errors.push(`fetch ${path}: ${resp.status}`); continue; }
          const buf = new Uint8Array(await resp.arrayBuffer());
          const ct = resp.headers.get("content-type") || "image/jpeg";
          const { error: upErr } = await sb.storage.from(BUCKET).upload(path, buf, {
            contentType: ct, upsert: true,
          });
          if (upErr) { stats.failed++; errors.push(`upload ${path}: ${upErr.message}`); continue; }
          const newUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
          const { error: updErr } = await sb.from("exercises").update({ imagen_url: newUrl }).eq("id", r.id);
          if (updErr) { stats.failed++; errors.push(`update ${r.id}: ${updErr.message}`); continue; }
          stats.migrated++;
        } catch (e) {
          stats.failed++;
          errors.push(`${path}: ${(e as Error).message}`);
        }
      }
    }
    await Promise.all(Array.from({ length: 8 }, worker));

    const { count } = await sb
      .from("exercises")
      .select("id", { count: "exact", head: true })
      .like("imagen_url", `${OLD_PREFIX}%`);
    stats.remaining_after = count ?? 0;

    return new Response(JSON.stringify({ stats, errors: errors.slice(0, 10) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
