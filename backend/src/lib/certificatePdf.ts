import fs from "node:fs";
import path from "node:path";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

// La plantilla es un diseño fijo (arte + marca de agua + bordes) provisto
// por ECSA; este módulo solo superpone los datos variables encima. Vive
// fuera de src/ (no se compila) para que quede disponible tal cual en
// runtime — ver backend/assets/.
const TEMPLATE_PATH = path.join(__dirname, "..", "..", "assets", "certificate-template.pdf");

const INK = rgb(0.1, 0.12, 0.14);
const GREEN = rgb(0.05, 0.35, 0.18);

// Posiciones expresadas como fracción del ancho/alto de la página (0 a 1,
// origen arriba-izquierda como en el diseño visual) para que sean fáciles
// de ajustar si no calzan exactamente con la plantilla real.
const LAYOUT = {
  holderName: { yFromTop: 0.465, size: 22 },
  courseTitle: { yFromTop: 0.605, size: 15, maxWidthFrac: 0.62 },
  fecha: { xFrac: 0.175, yFromTop: 0.715, size: 11 },
  duracion: { xFrac: 0.435, yFromTop: 0.715, size: 11 },
  modalidad: { xFrac: 0.695, yFromTop: 0.715, size: 11 },
  repName: { xFrac: 0.735, yFromTop: 0.825, size: 11, centered: true },
  repRole: { xFrac: 0.735, yFromTop: 0.855, size: 9, centered: true },
  code: { yFromTop: 0.975, size: 8 },
};

function yFromTopFrac(pageHeight: number, frac: number) {
  return pageHeight - pageHeight * frac;
}

function drawCentered(page: PDFPage, text: string, xCenter: number, y: number, size: number, font: PDFFont, color = INK) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: xCenter - w / 2, y, size, font, color });
}

// Reduce el tamaño de fuente hasta que el texto quepa en maxWidth (para
// títulos de capacitación largos dentro del recuadro fijo de la plantilla).
function fitFontSize(text: string, font: PDFFont, startSize: number, maxWidth: number): number {
  let size = startSize;
  while (size > 9 && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 1;
  }
  return size;
}

export interface CertificatePdfData {
  holderName: string;
  holderPosition: string | null;
  courseTitle: string;
  issuedAt: Date;
  durationMin: number;
  modality: string;
  code: string;
}

export async function renderCertificatePdf(data: CertificatePdfData): Promise<Uint8Array> {
  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const centerX = width / 2;

  // Nombre del titular (línea principal)
  drawCentered(page, data.holderName, centerX, yFromTopFrac(height, LAYOUT.holderName.yFromTop), LAYOUT.holderName.size, fontBold, GREEN);

  // Título de la capacitación (dentro del recuadro), con auto-ajuste de tamaño
  const courseMaxWidth = width * LAYOUT.courseTitle.maxWidthFrac;
  const courseSize = fitFontSize(data.courseTitle, fontBold, LAYOUT.courseTitle.size, courseMaxWidth);
  drawCentered(page, data.courseTitle, centerX, yFromTopFrac(height, LAYOUT.courseTitle.yFromTop), courseSize, fontBold, GREEN);

  // Fecha / Duración / Modalidad
  const fechaStr = data.issuedAt.toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric" });
  page.drawText(fechaStr, {
    x: width * LAYOUT.fecha.xFrac,
    y: yFromTopFrac(height, LAYOUT.fecha.yFromTop),
    size: LAYOUT.fecha.size,
    font: fontRegular,
    color: INK,
  });
  page.drawText(`${data.durationMin} min`, {
    x: width * LAYOUT.duracion.xFrac,
    y: yFromTopFrac(height, LAYOUT.duracion.yFromTop),
    size: LAYOUT.duracion.size,
    font: fontRegular,
    color: INK,
  });
  page.drawText(data.modality, {
    x: width * LAYOUT.modalidad.xFrac,
    y: yFromTopFrac(height, LAYOUT.modalidad.yFromTop),
    size: LAYOUT.modalidad.size,
    font: fontRegular,
    color: INK,
  });

  // Firma derecha: nombre y cargo del propio titular (según definición del cliente)
  drawCentered(
    page,
    data.holderName,
    width * LAYOUT.repName.xFrac,
    yFromTopFrac(height, LAYOUT.repName.yFromTop),
    LAYOUT.repName.size,
    fontBold,
    INK
  );
  if (data.holderPosition) {
    drawCentered(
      page,
      data.holderPosition,
      width * LAYOUT.repRole.xFrac,
      yFromTopFrac(height, LAYOUT.repRole.yFromTop),
      LAYOUT.repRole.size,
      fontRegular,
      INK
    );
  }

  // Código de verificación, discreto en el pie — permite validar en /verificar-certificado
  drawCentered(
    page,
    `Código de verificación: ${data.code}`,
    centerX,
    yFromTopFrac(height, LAYOUT.code.yFromTop),
    LAYOUT.code.size,
    fontRegular,
    rgb(0.5, 0.5, 0.5)
  );

  return pdfDoc.save();
}
