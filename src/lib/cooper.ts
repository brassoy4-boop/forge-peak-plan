// Cooper test calculations — fuente única de verdad para fórmulas y umbrales.

export type Sexo = "masculino" | "femenino" | "unisex";
export type Nivel = "EXCELENTE" | "MUY BUENO" | "BUENO" | "ACEPTABLE" | "REGULAR" | "BAJO";
export type Recuperacion = "EXCELENTE" | "NORMAL" | "LENTA";

export function calcularEdad(fechaNacimiento: string | null | undefined, fechaTest: string | Date): number | null {
  if (!fechaNacimiento) return null;
  const nac = new Date(fechaNacimiento);
  const ref = typeof fechaTest === "string" ? new Date(fechaTest) : fechaTest;
  if (isNaN(nac.getTime()) || isNaN(ref.getTime())) return null;
  let edad = ref.getFullYear() - nac.getFullYear();
  const m = ref.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < nac.getDate())) edad--;
  return edad;
}

/** VAM en km/h = distancia(m) / 200 */
export function calcularVAM(distanciaM: number | null | undefined): number | null {
  if (!distanciaM || distanciaM <= 0) return null;
  return Math.round((distanciaM / 200) * 100) / 100;
}

/** VO2max estimado, redondeado a 1 decimal */
export function calcularVO2max(distanciaM: number | null | undefined, sexo: Sexo): number | null {
  if (!distanciaM || distanciaM <= 0) return null;
  const v = sexo === "femenino" ? distanciaM * 0.020 - 7.5 : distanciaM * 0.0225 - 11.3;
  return Math.round(v * 10) / 10;
}

interface Umbral { excelente: number; muyBueno: number; bueno: number; aceptable: number; regular: number; }

// Umbrales VO2max por sexo y franja de edad. Configurable en un único lugar.
export const NIVELES_VO2: { hombre: Record<string, Umbral>; mujer: Record<string, Umbral> } = {
  hombre: {
    "<25":   { excelente: 63, muyBueno: 55, bueno: 48, aceptable: 42, regular: 35 },
    "25-34": { excelente: 60, muyBueno: 53, bueno: 47, aceptable: 40, regular: 33 },
    "35-44": { excelente: 57, muyBueno: 50, bueno: 43, aceptable: 37, regular: 31 },
    "45+":   { excelente: 54, muyBueno: 47, bueno: 41, aceptable: 35, regular: 29 },
  },
  mujer: {
    "<25":   { excelente: 55, muyBueno: 48, bueno: 41, aceptable: 35, regular: 28 },
    "25-34": { excelente: 52, muyBueno: 46, bueno: 39, aceptable: 33, regular: 26 },
    "35-44": { excelente: 49, muyBueno: 43, bueno: 36, aceptable: 30, regular: 24 },
    "45+":   { excelente: 47, muyBueno: 41, bueno: 34, aceptable: 28, regular: 22 },
  },
};

function franjaEdad(edad: number): "<25" | "25-34" | "35-44" | "45+" {
  if (edad < 25) return "<25";
  if (edad < 35) return "25-34";
  if (edad < 45) return "35-44";
  return "45+";
}

export function clasificarNivel(vo2max: number | null, sexo: Sexo, edad: number | null): Nivel | null {
  if (vo2max == null || edad == null) return null;
  const sx: "hombre" | "mujer" = sexo === "femenino" ? "mujer" : "hombre"; // unisex => hombre por defecto
  const u = NIVELES_VO2[sx][franjaEdad(edad)];
  if (vo2max >= u.excelente) return "EXCELENTE";
  if (vo2max >= u.muyBueno) return "MUY BUENO";
  if (vo2max >= u.bueno) return "BUENO";
  if (vo2max >= u.aceptable) return "ACEPTABLE";
  if (vo2max >= u.regular) return "REGULAR";
  return "BAJO";
}

export interface Ritmo { minPorKm: string; segPor400: string; }

function fmtMinSec(totalSeg: number): string {
  const m = Math.floor(totalSeg / 60);
  const s = Math.round(totalSeg % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtSeg(totalSeg: number): string {
  return `${Math.round(totalSeg)}s`;
}

function ritmoFromVel(velKmh: number): Ritmo {
  // min/km = 60/v ; seg/400 = 1440/v
  return {
    minPorKm: fmtMinSec((60 / velKmh) * 60),
    segPor400: fmtSeg(1440 / velKmh),
  };
}

export interface RitmosDerivados { rUmbral: Ritmo; billat: Ritmo; zona1: Ritmo; }

export function calcularRitmos(vam: number | null): RitmosDerivados | null {
  if (!vam || vam <= 0) return null;
  return {
    rUmbral: ritmoFromVel(vam * 0.85),
    billat: ritmoFromVel(vam * 1.0),
    zona1: ritmoFromVel(vam * 0.67),
  };
}

export function clasificarRecuperacion(seg: number | null | undefined): Recuperacion | null {
  if (seg == null) return null;
  if (seg < 90) return "EXCELENTE";
  if (seg <= 180) return "NORMAL";
  return "LENTA";
}

export function recuperacionLabel(rec: Recuperacion | null): string {
  if (rec === "EXCELENTE") return "⚡ EXCELENTE";
  if (rec === "NORMAL") return "✓ NORMAL";
  if (rec === "LENTA") return "⚠ LENTA";
  return "—";
}

/** Fase del test, equivalente a las 4 hojas del Excel. */
export type CooperFase = "inicial" | "mesociclo_1" | "mesociclo_2" | "pre_examen";
export const FASES: { id: CooperFase; label: string; short: string }[] = [
  { id: "inicial", label: "Test 1 — Inicial", short: "T1" },
  { id: "mesociclo_1", label: "Test 2 — Fin Mesociclo 1", short: "T2" },
  { id: "mesociclo_2", label: "Test 3 — Fin Mesociclo 2", short: "T3" },
  { id: "pre_examen", label: "Test 4 — Pre-Examen", short: "T4" },
];

export interface CooperDerivados {
  edad: number | null;
  vam: number | null;
  vo2max: number | null;
  nivel: Nivel | null;
  ritmos: RitmosDerivados | null;
  recuperacion: Recuperacion | null;
}

export function calcularDerivados(input: {
  fechaNacimiento: string | null | undefined;
  fechaTest: string;
  sexo: Sexo;
  distanciaM: number | null | undefined;
  tiempoBajo100: number | null | undefined;
}): CooperDerivados {
  const edad = calcularEdad(input.fechaNacimiento, input.fechaTest);
  const vam = calcularVAM(input.distanciaM);
  const vo2max = calcularVO2max(input.distanciaM, input.sexo);
  return {
    edad,
    vam,
    vo2max,
    nivel: clasificarNivel(vo2max, input.sexo, edad),
    ritmos: calcularRitmos(vam),
    recuperacion: clasificarRecuperacion(input.tiempoBajo100),
  };
}

export function nivelColor(nivel: Nivel | null): string {
  switch (nivel) {
    case "EXCELENTE": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "MUY BUENO": return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30";
    case "BUENO": return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
    case "ACEPTABLE": return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
    case "REGULAR": return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
    case "BAJO": return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30";
    default: return "bg-muted text-muted-foreground";
  }
}
