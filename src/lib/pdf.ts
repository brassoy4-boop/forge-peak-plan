import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface RoutinePdfData {
  nombre: string;
  descripcion?: string | null;
  num_dias: number;
  days: Array<{
    dia_num: number;
    nombre: string | null;
    exercises: Array<{
      nombre: string;
      series: number | null;
      repeticiones: string | null;
      descanso: string | null;
      tiempo: string | null;
      carga: string | null;
      observaciones: string | null;
    }>;
  }>;
  athlete?: string;
}

export function exportRoutinePdf(data: RoutinePdfData) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(data.nombre, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  if (data.athlete) doc.text(`Deportista: ${data.athlete}`, 14, 26);
  if (data.descripcion) doc.text(data.descripcion, 14, 32);
  let y = data.descripcion || data.athlete ? 40 : 30;

  data.days.forEach((d) => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setTextColor(20);
    doc.text(`Día ${d.dia_num}${d.nombre ? ` — ${d.nombre}` : ""}`, 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Ejercicio", "Series", "Reps", "Tiempo", "Carga", "Descanso", "Notas"]],
      body: d.exercises.length
        ? d.exercises.map((e) => [
            e.nombre, e.series ?? "—", e.repeticiones ?? "—",
            e.tiempo ?? "—", e.carga ?? "—", e.descanso ?? "—", e.observaciones ?? "",
          ])
        : [["Sin ejercicios", "", "", "", "", "", ""]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 30, 30] },
      margin: { left: 14, right: 14 },
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
