import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface RoutinePdfExercise {
  nombre: string;
  series: number | null;
  repeticiones: string | null;
  descanso: string | null;
  tiempo: string | null;
  carga: string | null;
  observaciones: string | null;
  imagen_url?: string | null;
}

interface RoutinePdfData {
  nombre: string;
  descripcion?: string | null;
  num_dias: number;
  days: Array<{
    dia_num: number;
    nombre: string | null;
    exercises: RoutinePdfExercise[];
  }>;
  athlete?: string;
}

async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function detectFormat(dataUrl: string): "JPEG" | "PNG" | null {
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) return "JPEG";
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "PNG"; // best effort
  return null;
}

export async function exportRoutinePdf(data: RoutinePdfData) {
  const doc = new jsPDF();

  // Prefetch all images in parallel (deduped)
  const uniqueUrls = Array.from(
    new Set(
      data.days.flatMap((d) => d.exercises.map((e) => e.imagen_url).filter((u): u is string => !!u))
    )
  );
  const imageMap: Record<string, { dataUrl: string; format: "JPEG" | "PNG" }> = {};
  await Promise.all(
    uniqueUrls.map(async (url) => {
      const dataUrl = await fetchImageDataUrl(url);
      if (!dataUrl) return;
      const format = detectFormat(dataUrl);
      if (!format) return;
      imageMap[url] = { dataUrl, format };
    })
  );

  doc.setFontSize(18);
  doc.text(data.nombre, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  if (data.athlete) doc.text(`Deportista: ${data.athlete}`, 14, 26);
  if (data.descripcion) doc.text(data.descripcion, 14, 32);
  let y = data.descripcion || data.athlete ? 40 : 30;

  data.days.forEach((d) => {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setTextColor(20);
    doc.text(`Día ${d.dia_num}${d.nombre ? ` — ${d.nombre}` : ""}`, 14, y);
    y += 4;

    const body = d.exercises.length
      ? d.exercises.map((e) => [
          "", // image cell
          e.nombre,
          e.series ?? "—",
          e.repeticiones ?? "—",
          e.tiempo ?? "—",
          e.carga ?? "—",
          e.descanso ?? "—",
          e.observaciones ?? "",
        ])
      : [["", "Sin ejercicios", "", "", "", "", "", ""]];

    autoTable(doc, {
      startY: y,
      head: [["Img", "Ejercicio", "Series", "Reps", "Tiempo", "Carga", "Descanso", "Notas"]],
      body,
      styles: { fontSize: 9, valign: "middle", minCellHeight: 16 },
      headStyles: { fillColor: [30, 30, 30] },
      columnStyles: {
        0: { cellWidth: 18, halign: "center" },
        1: { cellWidth: 38 },
        2: { cellWidth: 14 },
        3: { cellWidth: 18 },
        4: { cellWidth: 16 },
        5: { cellWidth: 16 },
        6: { cellWidth: 18 },
        7: { cellWidth: "auto" },
      },
      margin: { left: 14, right: 14 },
      didDrawCell: (hookData) => {
        if (hookData.section !== "body" || hookData.column.index !== 0) return;
        const row = hookData.row.index;
        const ex = d.exercises[row];
        if (!ex || !ex.imagen_url) return;
        const img = imageMap[ex.imagen_url];
        if (!img) return;
        const cell = hookData.cell;
        const size = Math.min(cell.width - 2, cell.height - 2, 14);
        const x = cell.x + (cell.width - size) / 2;
        const yy = cell.y + (cell.height - size) / 2;
        try {
          doc.addImage(img.dataUrl, img.format, x, yy, size, size);
        } catch {
          // ignore
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  });

  doc.save(`rutina-${data.nombre.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

interface PersonalizedPdfData {
  titulo: string;
  athlete?: string;
  versions: Array<{
    version: number;
    created_at: string;
    bloques: Array<{ tipo: string; contenido: string }>;
  }>;
}

export function exportPersonalizedPdf(data: PersonalizedPdfData) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(data.titulo, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  if (data.athlete) doc.text(`Deportista: ${data.athlete}`, 14, 26);
  let y = 34;

  data.versions.forEach((v) => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text(`Versión ${v.version} — ${new Date(v.created_at).toLocaleDateString("es-ES")}`, 14, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(60);
    v.bloques?.forEach((b) => {
      const lines = doc.splitTextToSize(b.contenido ?? "", 180);
      lines.forEach((line: string) => {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.text(line, 14, y);
        y += 5;
      });
      y += 3;
    });
    y += 4;
  });

  doc.save(`personalizado-${data.titulo.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
