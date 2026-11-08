import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, readFile, rm, stat, writeFile, type FileHandle } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { MediaUploadTicket } from "../../contracts/MediaContracts";
import type { MediaStorage, StoredObject, UploadPermission } from "../../domains/media/application/ports/MediaStorage";

// ---------------------------------------------------------------------------
// Medios en una carpeta local: SOLO desarrollo (la API no lo usa en
// producción). Imita el contrato de Vercel Blob: un permiso firmado de un
// solo uso para subir una ruta concreta con tipo y tamaño acotados, y las
// URLs las sirve la propia API en `/media/local/files/…`.
// ---------------------------------------------------------------------------

interface TicketPayload {
  readonly p: string;
  readonly t: ReadonlyArray<string>;
  readonly m: number;
  readonly e: number;
}

export class LocalMediaStorage implements MediaStorage {
  private readonly secret = randomBytes(32);

  public constructor(
    private readonly rootDirectory: string,
    /** Dirección pública de la API, p. ej. `http://localhost:3100`. */
    private readonly publicBaseUrl: string
  ) {}

  private sign(payload: string): string {
    return createHmac("sha256", this.secret).update(payload).digest("base64url");
  }

  /** Ruta de disco de un objeto; `null` si se sale de la carpeta. */
  private filePath(pathname: string): string | null {
    const root = resolve(this.rootDirectory);
    const target = resolve(root, pathname);
    return target.startsWith(root + sep) ? target : null;
  }

  public async createUploadTicket(permission: UploadPermission): Promise<MediaUploadTicket> {
    const payload = Buffer.from(
      JSON.stringify({ p: permission.pathname, t: permission.allowedContentTypes, m: permission.maxBytes, e: permission.expiresAt.getTime() } satisfies TicketPayload)
    ).toString("base64url");
    const ticket = `${payload}.${this.sign(payload)}`;
    return {
      strategy: "direct",
      pathname: permission.pathname,
      uploadUrl: `${this.publicBaseUrl}/media/local/upload?ticket=${ticket}`,
      expiresAt: permission.expiresAt.toISOString()
    };
  }

  private readTicket(ticket: string): TicketPayload | null {
    const [payload, signature] = ticket.split(".");
    if (!payload || !signature) return null;
    const expected = Buffer.from(this.sign(payload));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TicketPayload;
    return Date.now() <= data.e ? data : null;
  }

  /** PUT con el permiso firmado: guarda el cuerpo si cumple tipo y tamaño. */
  public async receiveUpload(request: IncomingMessage, response: ServerResponse, ticket: string): Promise<void> {
    const permission = this.readTicket(ticket);
    const contentType = (request.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
    const target = permission ? this.filePath(permission.p) : null;
    if (!permission || !target) return reply(response, 403, { message: "Permiso de subida no válido o vencido." });
    if (!permission.t.includes(contentType)) return reply(response, 415, { message: "Tipo de archivo no permitido." });

    await mkdir(dirname(target), { recursive: true });
    // Apertura exclusiva: un permiso sirve para UNA subida.
    let handle: FileHandle;
    try {
      handle = await open(target, "wx");
    } catch {
      return reply(response, 409, { message: "Esa subida ya se usó." });
    }

    let size = 0;
    try {
      for await (const chunk of request) {
        size += (chunk as Buffer).length;
        if (size > permission.m) throw new Error("too_large");
        await handle.write(chunk as Buffer);
      }
    } catch {
      await handle.close();
      await rm(target, { force: true });
      return reply(response, 413, { message: "El archivo supera el tamaño permitido." });
    }
    await handle.close();
    await writeFile(`${target}.meta.json`, JSON.stringify({ contentType }));
    reply(response, 200, { pathname: permission.p });
  }

  /** GET público de un objeto (como una URL de Blob). */
  public async serve(response: ServerResponse, pathname: string): Promise<void> {
    const target = this.filePath(pathname);
    const meta = target ? await readFile(`${target}.meta.json`, "utf8").catch(() => null) : null;
    if (!target || !meta) return reply(response, 404, { message: "No existe." });
    const { contentType } = JSON.parse(meta) as { contentType: string };
    response.statusCode = 200;
    response.setHeader("Content-Type", contentType);
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    createReadStream(target).pipe(response);
  }

  public async describe(pathname: string): Promise<StoredObject | null> {
    const target = this.filePath(pathname);
    if (!target) return null;
    const [info, meta] = await Promise.all([stat(target).catch(() => null), readFile(`${target}.meta.json`, "utf8").catch(() => null)]);
    if (!info || !meta) return null;
    return { url: `${this.publicBaseUrl}/media/local/files/${pathname}`, size: info.size, contentType: (JSON.parse(meta) as { contentType: string }).contentType };
  }

  public async remove(pathname: string): Promise<void> {
    const target = this.filePath(pathname);
    if (!target) return;
    await Promise.all([rm(target, { force: true }), rm(`${target}.meta.json`, { force: true })]);
  }
}

function reply(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

export function defaultLocalMediaDirectory(): string {
  return join(process.cwd(), "data", "media");
}
