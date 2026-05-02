// Utilidades de validación de marcas (tiempo, números) y de sexo en simulacros.

export type Sexo = "masculino" | "femenino" | "unisex";

export type TiempoFormato = "hh:mm:ss" | "mm:ss" | "segundos" | "segundos_centesimas";

export const TIEMPO_FORMATO_OPTIONS: { value: TiempoFormato; label: string; placeholder: string }[] = [
  { value: "hh:mm:ss", label: "HH:MM:SS", placeholder: "01:23:45" },
  { value: "mm:ss", label: "MM:SS", placeholder: "12:34" },
  { value: "segundos", label: "Segundos (entero)", placeholder: "45" },
  { value: "segundos_centesimas", label: "Segundos.centésimas", placeholder: "12.34" },
];

/**
 * Parser de tiempo legacy (compat): admite mm:ss, mm:ss.cc, hh:mm:ss, hh:mm:ss.cc, o segundos decimales.
 * Devuelve segundos totales o null.
 */
export function parseTimeToSeconds(input: string): number | null {
  if (!input) return null;
  const s = input.trim();
  const re = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,2}))?$/;
  const m = s.match(re);
  if (!m) {
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

/**
 * Parsea tiempo según formato concreto. Devuelve segundos o null.
 */
export function parseTimeByFormato(input: string, formato: TiempoFormato | null | undefined): number | null {
  if (!input) return null;
  const s = input.trim().replace(",", ".");
  switch (formato) {
    case "hh:mm:ss": {
      const m = s.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d{1,2}))?$/);
      if (!m) return null;
      const h = +m[1], mi = +m[2], se = +m[3], cs = m[4] ? parseInt(m[4].padEnd(2, "0"), 10) : 0;
      if (mi > 59 || se > 59) return null;
      return h * 3600 + mi * 60 + se + cs / 100;
    }
    case "mm:ss": {
      const m = s.match(/^(\d{1,3}):(\d{1,2})(?:\.(\d{1,2}))?$/);
      if (!m) return null;
      const mi = +m[1], se = +m[2], cs = m[3] ? parseInt(m[3].padEnd(2, "0"), 10) : 0;
      if (se > 59) return null;
      return mi * 60 + se + cs / 100;
    }
    case "segundos": {
      if (!/^\d+$/.test(s)) return null;
      return parseInt(s, 10);
    }
    case "segundos_centesimas": {
      if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
      return Number(s);
    }
    default:
      // sin formato → compat
      return parseTimeToSeconds(s);
  }
}

export function tiempoPlaceholder(formato: TiempoFormato | null | undefined): string {
  const opt = TIEMPO_FORMATO_OPTIONS.find((o) => o.value === formato);
  return opt?.placeholder ?? "mm:ss.cc";
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
 * Validador unificado por value_type. Devuelve {ok, valor_numerico, valor_texto, error}.
 * Para tipo "tiempo" guarda los segundos en valor_numerico y el string original en valor_texto.
 */
export interface MarkValueParseResult {
  ok: boolean;
  valor_numerico: number | null;
  valor_texto: string | null;
  error?: string;
}

export function parseMarkValue(
  input: string,
  value_type: string,
  tiempo_formato?: TiempoFormato | null,
): MarkValueParseResult {
  const s = (input ?? "").toString().trim();
  if (!s) return { ok: true, valor_numerico: null, valor_texto: null };

  switch (value_type) {
    case "tiempo": {
      const seg = parseTimeByFormato(s, tiempo_formato ?? null);
      if (seg == null) {
        const exp = tiempo_formato ? `formato ${tiempoPlaceholder(tiempo_formato)}` : "formato mm:ss[.cc]";
        return { ok: false, valor_numerico: null, valor_texto: null, error: `Tiempo inválido. Usa ${exp}.` };
      }
      return { ok: true, valor_numerico: seg, valor_texto: s };
    }
    case "distancia":
    case "peso":
    case "puntuacion": {
      if (!isValidNumber(s, true)) return { ok: false, valor_numerico: null, valor_texto: null, error: "Debe ser un número (decimales permitidos)." };
      return { ok: true, valor_numerico: Number(s.replace(",", ".")), valor_texto: null };
    }
    case "repeticiones": {
      if (!/^\d+$/.test(s)) return { ok: false, valor_numerico: null, valor_texto: null, error: "Debe ser un número entero ≥ 0." };
      return { ok: true, valor_numerico: parseInt(s, 10), valor_texto: null };
    }
    case "booleano": {
      const norm = s.toLowerCase();
      if (["1", "true", "sí", "si", "yes"].includes(norm)) return { ok: true, valor_numerico: 1, valor_texto: null };
      if (["0", "false", "no"].includes(norm)) return { ok: true, valor_numerico: 0, valor_texto: null };
      return { ok: false, valor_numerico: null, valor_texto: null, error: "Debe ser sí/no o 0/1." };
    }
    case "texto":
    default:
      return { ok: true, valor_numerico: null, valor_texto: s };
  }
}

/**
 * Comprueba si un usuario con `userSexo` puede ejecutar un simulacro con `templateSexo`.
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
