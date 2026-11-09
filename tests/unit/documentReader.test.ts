import { afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { TesseractDocumentReader } from "../../infrastructure/documents/TesseractDocumentReader.js";
import { extractReceipt } from "../../flow-engine/nodes/payment-proof/extractReceipt.js";

// ---------------------------------------------------------------------------
// Lector de comprobantes REAL (OCR propio + texto de PDF), sin IA ni red. Usa
// una captura de una transferencia de ejemplo y comprueba que el texto que
// sale alcanza para extraer valor, fecha, referencia y pagador.
// ---------------------------------------------------------------------------

const fixture = fileURLToPath(new URL("../fixtures/receipts/transferencia-bancolombia.png", import.meta.url));
const reader = new TesseractDocumentReader();
afterAll(() => reader.close());

/** Un PDF mínimo de una página con texto (Helvetica), con su tabla xref. */
function textPdf(lines: ReadonlyArray<string>): Uint8Array {
  const content = `BT /F1 14 Tf 50 750 Td 18 TL ${lines.map((line) => `(${line}) '`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

describe("TesseractDocumentReader", () => {
  it("lee una captura de transferencia y alcanza para extraer sus datos", async () => {
    const result = await reader.read({ bytes: new Uint8Array(readFileSync(fixture)), contentType: "image/png" });
    expect(result.ok && result.method).toBe("ocr");
    const facts = extractReceipt(result.ok ? result.text : "", "America/Bogota");
    expect(facts.amount).toBe(149900);
    expect(facts.reference).toBe("M8743219");
    expect(facts.date?.local).toBe("2026-11-08 10:35");
    expect(facts.payer).toBe("Laura Gómez");
  }, 30_000);

  it("lee comprobantes en modo oscuro (los invierte)", async () => {
    const dark = await sharp(readFileSync(fixture)).negate({ alpha: false }).jpeg().toBuffer();
    const result = await reader.read({ bytes: new Uint8Array(dark), contentType: "image/jpeg" });
    const facts = extractReceipt(result.ok ? result.text : "", "America/Bogota");
    expect(facts.amount).toBe(149900);
    expect(facts.reference).toBe("M8743219");
  }, 30_000);

  it("lee el texto de un PDF", async () => {
    const pdf = textPdf(["Comprobante de pago", "Valor $ 75.000", "Referencia ABC12345", "Fecha 08/11/2026 09:00"]);
    const result = await reader.read({ bytes: pdf, contentType: "application/pdf" });
    expect(result.ok && result.method).toBe("pdf-text");
    const facts = extractReceipt(result.ok ? result.text : "", "America/Bogota");
    expect(facts.amount).toBe(75000);
    expect(facts.reference).toBe("ABC12345");
  }, 30_000);

  it("rechaza lo que no es imagen ni PDF, y lo dañado", async () => {
    expect(await reader.read({ bytes: new Uint8Array([1, 2, 3]), contentType: "audio/ogg" })).toMatchObject({ ok: false, reason: "unsupported_type" });
    expect(await reader.read({ bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2]), contentType: "image/png" })).toMatchObject({ ok: false, reason: "unreadable" });
    expect(await reader.read({ bytes: new Uint8Array(), contentType: "image/png" })).toMatchObject({ ok: false, reason: "unreadable" });
  });

  it("una imagen sin texto no es legible", async () => {
    const blank = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#ffffff" } }).png().toBuffer();
    expect(await reader.read({ bytes: new Uint8Array(blank), contentType: "image/png" })).toMatchObject({ ok: false, reason: "unreadable" });
  }, 30_000);
});
