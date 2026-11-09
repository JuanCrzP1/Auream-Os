import { createRequire } from "node:module";
import path from "node:path";
import type { DocumentInput, DocumentReadResult, DocumentTextReader } from "../../flow-engine/ports/DocumentTextReader";

// ---------------------------------------------------------------------------
// TesseractDocumentReader — el texto de un comprobante, leído en el propio
// servidor. Sin IA, sin claves y sin coste por uso:
//
//   imagen → sharp (enderezar, gris, positivo, ampliar) → Tesseract (OCR)
//   PDF    → su capa de texto (unpdf); un PDF escaneado no tiene → «ilegible»
//
// El modelo de español viaja en el paquete (`@tesseract.js-data/spa`): no se
// descarga nada al arrancar. Un solo motor de OCR por instancia, creado al
// primer uso y reutilizado mientras la función siga caliente; si una lectura
// se cuelga, se descarta y el siguiente uso crea otro.
// ---------------------------------------------------------------------------

export interface TesseractReaderOptions {
  /** Plazo de una lectura (OCR o PDF). */
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 25_000;
/** Ancho al que se lleva la imagen: el OCR lee mejor letras de ~30 px. */
const MIN_WIDTH = 1800;
const MAX_WIDTH = 2600;
/** Imágenes absurdamente grandes (bombas de descompresión) se rechazan. */
const MAX_INPUT_PIXELS = 50_000_000;
const MIN_TEXT_CHARS = 15;

const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/tiff"]);

type Worker = import("tesseract.js").Worker;

const requireFromRoot = createRequire(path.join(process.cwd(), "package.json"));

class ReadTimeout extends Error {}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ReadTimeout()), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

export class TesseractDocumentReader implements DocumentTextReader {
  private worker: Promise<Worker> | null = null;
  private readonly timeoutMs: number;

  public constructor(options: TesseractReaderOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  public async read(document: DocumentInput): Promise<DocumentReadResult> {
    const type = document.contentType.toLowerCase();
    if (document.bytes.byteLength === 0) return { ok: false, reason: "unreadable", message: "El archivo está vacío." };

    try {
      if (type === "application/pdf") return await withTimeout(this.readPdf(document.bytes), this.timeoutMs);
      if (IMAGE_TYPES.has(type)) return await withTimeout(this.readImage(document.bytes), this.timeoutMs);
    } catch (error) {
      if (error instanceof ReadTimeout) {
        this.discardWorker();
        return { ok: false, reason: "timeout", message: "Leer el comprobante tardó demasiado." };
      }
      return { ok: false, reason: "unreadable", message: "No se pudo abrir el archivo: está dañado o no es una imagen válida." };
    }
    return { ok: false, reason: "unsupported_type", message: "El archivo no es una imagen ni un PDF." };
  }

  /** Cierra el motor de OCR (al apagar el servidor o en tests). */
  public async close(): Promise<void> {
    const worker = this.worker;
    this.worker = null;
    if (worker) await (await worker).terminate().catch(() => undefined);
  }

  private async readImage(bytes: Uint8Array): Promise<DocumentReadResult> {
    const prepared = await prepareImage(bytes);
    const worker = await this.ensureWorker();
    const result = await worker.recognize(prepared);
    return textResult(result.data.text, "ocr");
  }

  private async readPdf(bytes: Uint8Array): Promise<DocumentReadResult> {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    // Un comprobante es de una o dos páginas: no se leen documentos enteros.
    const { text } = await extractText(pdf, { mergePages: false });
    const pages = (Array.isArray(text) ? text : [text]).slice(0, 3).join("\n");
    const result = textResult(pages, "pdf-text");
    return result.ok
      ? result
      : { ok: false, reason: "unreadable", message: "El PDF no tiene texto (es una imagen escaneada). Pide una captura de pantalla del comprobante." };
  }

  private ensureWorker(): Promise<Worker> {
    if (!this.worker) {
      this.worker = createOcrWorker();
      this.worker.catch(() => {
        this.worker = null;
      });
    }
    return this.worker;
  }

  private discardWorker(): void {
    const worker = this.worker;
    this.worker = null;
    worker?.then((instance) => instance.terminate()).catch(() => undefined);
  }
}

async function createOcrWorker(): Promise<Worker> {
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  const langPath = path.join(path.dirname(requireFromRoot.resolve("@tesseract.js-data/spa/package.json")), "4.0.0_best_int");
  const worker = await createWorker("spa", OEM.LSTM_ONLY, { langPath, gzip: true, cacheMethod: "none" });
  // Un comprobante es un bloque de texto: leerlo como tal ordena mejor las líneas.
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: "1", user_defined_dpi: "300" });
  return worker;
}

/**
 * Enderezada, en gris, al tamaño ideal y en positivo (texto oscuro sobre
 * claro). Sin «normalizar» el histograma: en una captura casi toda blanca el
 * fondo cae en el percentil bajo y se volvería negro. El umbral lo pone
 * Tesseract (Otsu), que se adapta a cada imagen.
 */
async function prepareImage(bytes: Uint8Array): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const input = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const gray = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, animated: false })
    .rotate()
    .flatten({ background: "#ffffff" })
    .grayscale()
    .toBuffer({ resolveWithObject: true });

  // Comprobantes en modo oscuro: se invierten para que el texto quede negro.
  // En su propia pasada: combinada con `sharpen` en la misma, sharp oscurece todo.
  const { channels } = await sharp(gray.data).stats();
  const dark = (channels[0]?.mean ?? 255) < 110;
  const positive = dark ? await sharp(gray.data).negate({ alpha: false }).png().toBuffer() : gray.data;
  const targetWidth = Math.min(Math.max(gray.info.width, MIN_WIDTH), MAX_WIDTH);

  return sharp(positive).resize({ width: targetWidth, kernel: "lanczos3" }).sharpen().png().toBuffer();
}

function textResult(raw: string, method: "ocr" | "pdf-text"): DocumentReadResult {
  const text = raw.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
  if (text.replace(/\s/g, "").length < MIN_TEXT_CHARS) {
    return { ok: false, reason: "unreadable", message: "No se encontró texto legible en el archivo." };
  }
  return { ok: true, text, method };
}
