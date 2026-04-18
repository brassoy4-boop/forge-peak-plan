import { supabase } from "@/integrations/supabase/client";

export interface Baremo {
  id: string;
  mark_id: string;
  oposicion_id: string | null;
  sexo: "masculino" | "femenino" | "unisex";
  nivel: string;
  valor_min: number | null;
  valor_max: number | null;
  orden: number;
}

export const NIVEL_COLORS: Record<string, string> = {
  insuficiente: "bg-destructive/15 text-destructive border-destructive/30",
  medio: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  bueno: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  excelente: "bg-primary/15 text-primary border-primary/30",
};

export function findNivel(baremos: Baremo[], valor: number): Baremo | null {
  if (valor == null || isNaN(valor)) return null;
  const sorted = [...baremos].sort((a, b) => a.orden - b.orden);
  for (const b of sorted) {
    const min = b.valor_min ?? -Infinity;
    const max = b.valor_max ?? Infinity;
    if (valor >= min && valor <= max) return b;
  }
  return null;
}

export async function fetchBaremos(markId: string, sexo: string | null, oposicionId: string | null): Promise<Baremo[]> {
  const sexos = sexo ? [sexo, "unisex"] : ["unisex"];
  let query = supabase.from("mark_baremos").select("*").eq("mark_id", markId).in("sexo", sexos as any);
  const { data } = await query;
  const all = (data ?? []) as Baremo[];
  // Prefer rows matching the user's oposición; fall back to oposicion_id null
  if (oposicionId) {
    const matching = all.filter((b) => b.oposicion_id === oposicionId);
    if (matching.length) return matching;
  }
  return all.filter((b) => b.oposicion_id === null);
}
