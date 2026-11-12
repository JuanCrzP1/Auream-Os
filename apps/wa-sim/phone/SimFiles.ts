import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

// ---------------------------------------------------------------------------
// Los archivos que «envía» el cliente de prueba (foto del comprobante, audio,
// documento): se guardan en `data/wa-sim/files` y se sirven en
// `/_sim/files/<id>`, como el enlace de un archivo que da uazapi.
// ---------------------------------------------------------------------------

const MAX_BYTES = 16 * 1024 * 1024;
const SAFE_ID = /^[a-z0-9]{16}\.[a-z0-9]{1,5}$/;

const EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "audio/ogg": "ogg", "audio/mpeg": "mp3",
  "audio/mp4": "m4a", "audio/webm": "webm", "application/pdf": "pdf"
};

export class SimFiles {
  public constructor(private readonly folder: string, private readonly publicBase: string) {
    mkdirSync(folder, { recursive: true });
  }

  /** Guarda el archivo y devuelve su enlace público. */
  public save(base64: string, mimeType: string): { readonly url: string; readonly mimeType: string } {
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length === 0 || bytes.length > MAX_BYTES) throw new Error("El archivo está vacío o pasa de 16 MB.");
    const extension = EXTENSIONS[mimeType] ?? "bin";
    const id = `${randomBytes(8).toString("hex")}.${extension}`;
    writeFileSync(join(this.folder, id), bytes);
    return { url: `${this.publicBase}/_sim/files/${id}`, mimeType };
  }

  /** Los bytes y su tipo, o `null` si no existe (o el id no es uno nuestro). */
  public read(id: string): { readonly bytes: Buffer; readonly mimeType: string } | null {
    if (!SAFE_ID.test(id)) return null;
    const path = join(this.folder, id);
    if (!existsSync(path)) return null;
    const extension = id.split(".").pop()!;
    const mimeType = Object.entries(EXTENSIONS).find(([, value]) => value === extension)?.[0] ?? "application/octet-stream";
    return { bytes: readFileSync(path), mimeType };
  }
}
