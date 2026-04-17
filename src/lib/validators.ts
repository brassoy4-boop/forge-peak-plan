// Utilidades de validación de marcas (tiempo, números) y de sexo en simulacros.

export type Sexo = "masculino" | "femenino" | "unisex";

/**
 * Valida formato de tiempo permitido: mm:ss, mm:ss.cc, hh:mm:ss, hh:mm:ss.cc
 * Devuelve los segundos totales (number) o null si no es válido.
 */
export function parseTimeToSeconds(input: string): number | null {
  if (!input) return null;
  const s = input.trim();
  // Formatos aceptados
  const re = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,2}))?$/;
  const m = s.match(re);
  if (!m) {
    // permitir solo segundos en decimal (ej. 12.34)
    const num = Number(s.replace(",", "."));
    if (!isNaN(num) && num >= 0) return num;
    return null;
  }
  const h = m[1] ? parseInt(m[1], 10) : 0;
  const min = parseInt(m[2], 10);
  const sec = parseInt(m[3], 10);
  const cs = m[4] ? parseInt(m[4].padEnd(2, "0"), 10) : 0;
  if (min > 59 || sec > 59) return null;
  return h * 3600 + min * 60 + sec + cs / 100;
}

export function isValidTime(input: string): boolean {
  return parseTimeToSeconds(input) !== null;
}

export function formatSecondsToTime(total: number | null | undefined): string {
  if (total == null || isNaN(total)) return "";
  const h = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const sec = Math.floor(total % 60);
  const cs = Math.round((total - Math.floor(total)) * 100);
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${h}:${pad(min)}:${pad(sec)}${cs ? "." + pad(cs) : ""}`;
  return `${pad(min)}:${pad(sec)}${cs ? "." + pad(cs) : ""}`;
}

export function isValidNumber(input: string, allowDecimal = true): boolean {
  if (!input) return false;
  const v = Number(input.replace(",", "."));
  if (isNaN(v)) return false;
  if (!allowDecimal && !Number.isInteger(v)) return false;
  return true;
}

/**
 * Comprueba si un usuario con `userSexo` puede ejecutar un simulacro con `templateSexo`.
 * `unisex` admite cualquiera. Si el usuario no tiene sexo asignado, también se bloquea
 * cuando la plantilla pide masculino/femenino.
 */
export function canExecuteSimulacro(
  templateSexo: Sexo,
  userSexo: Sexo | null | undefined
): { ok: boolean; reason?: string } {
  if (templateSexo === "unisex") return { ok: true };
  if (!userSexo) return { ok: false, reason: "El deportista no tiene sexo asignado en su perfil." };
  if (userSexo !== templateSexo) {
    return {
      ok: false,
      reason: `Esta plantilla es para sexo "${templateSexo}" y el deportista es "${userSexo}".`,
    };
  }
  return { ok: true };
}
