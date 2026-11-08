import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createServer, request as httpRequest, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CreateMediaUploadService, RegisterMediaService } from "../../domains/media/application/MediaServices.js";
import { mediaIdFromPathname, mediaPathname, safeFileName } from "../../domains/media/domain/MediaAsset.js";
import type { MediaStorage, StoredObject, UploadPermission } from "../../domains/media/application/ports/MediaStorage.js";
import { InMemoryMediaRepository } from "../../infrastructure/persistence/memory/InMemoryMediaRepository.js";
import { InMemoryRateLimiter } from "../../platform/security/rate-limiting/application/InMemoryRateLimiter.js";
import { LocalMediaStorage } from "../../infrastructure/media/LocalMediaStorage.js";
import { ValidationError } from "../../platform/observability/errors/ValidationError.js";
import type { MediaUploadTicket } from "../../contracts/MediaContracts.js";

// ---------------------------------------------------------------------------
// Medios: permiso de subida acotado (tipo, tamaño, ruta de la cuenta) y
// registro que confía en lo que hay en el almacén, no en lo que dice el
// navegador. Y el almacén local de desarrollo con permisos firmados.
// ---------------------------------------------------------------------------

const T = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const MB = 1024 * 1024;

class FakeStorage implements MediaStorage {
  public permissions: UploadPermission[] = [];
  public objects = new Map<string, StoredObject>();
  public removed: string[] = [];
  public async createUploadTicket(permission: UploadPermission): Promise<MediaUploadTicket> {
    this.permissions.push(permission);
    return { strategy: "direct", pathname: permission.pathname, uploadUrl: "x", expiresAt: permission.expiresAt.toISOString() };
  }
  public async describe(pathname: string) {
    return this.objects.get(pathname) ?? null;
  }
  public async remove(pathname: string) {
    this.removed.push(pathname);
    this.objects.delete(pathname);
  }
}

let storage: FakeStorage;
let repo: InMemoryMediaRepository;
beforeEach(() => {
  storage = new FakeStorage();
  repo = new InMemoryMediaRepository();
});
const ticketFor = (input: Record<string, unknown>, tenant = T) => new CreateMediaUploadService(storage, new InMemoryRateLimiter()).execute(tenant, input);

describe("nombres y rutas", () => {
  it.each([
    ["Mi foto (1).JPG", "mi-foto-1.jpg"],
    ["../../etc/passwd", "passwd"],
    ["Catálogo Ñandú 2026.pdf", "catalogo-nandu-2026.pdf"],
    ["   .mp4", "archivo.mp4"]
  ])("%s → %s", (name, safe) => {
    expect(safeFileName(name)).toBe(safe);
  });

  it("la ruta queda en la carpeta de la cuenta y solo esa cuenta la reconoce", () => {
    const id = "33333333-3333-4333-8333-333333333333";
    const pathname = mediaPathname(T, id, "foto.jpg");
    expect(pathname).toBe(`tenants/${T}/media/${id}/foto.jpg`);
    expect(mediaIdFromPathname(T, pathname)).toBe(id);
    expect(mediaIdFromPathname(OTHER, pathname)).toBeNull();
    expect(mediaIdFromPathname(T, `tenants/${T}/media/${id}/../../x`)).toBeNull();
  });
});

describe("permiso de subida", () => {
  it("acota tipo, tamaño, ruta y vencimiento", async () => {
    const ticket = await ticketFor({ kind: "image", fileName: "Promo.png", contentType: "image/png", size: 2 * MB });
    const permission = storage.permissions[0]!;
    expect(ticket.pathname).toMatch(new RegExp(`^tenants/${T}/media/[0-9a-f-]{36}/promo\\.png$`));
    expect(permission).toMatchObject({ allowedContentTypes: ["image/png"], maxBytes: 5 * MB });
    expect(permission.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it.each([
    [{ kind: "image", fileName: "a.gif", contentType: "image/gif", size: 10 }, /formato/],
    [{ kind: "image", fileName: "a.jpg", contentType: "image/jpeg", size: 6 * MB }, /máximo de WhatsApp \(5 MB\)/],
    [{ kind: "video", fileName: "a.mov", contentType: "video/quicktime", size: 10 }, /formato/],
    [{ kind: "audio", fileName: "a.mp3", contentType: "audio/mpeg", size: 0 }, /vacío/],
    [{ kind: "otro", fileName: "a", contentType: "x", size: 1 }, /no válido/]
  ])("rechaza lo que WhatsApp no acepta %#", async (input, message) => {
    await expect(ticketFor(input)).rejects.toThrow(message);
    expect(storage.permissions).toHaveLength(0);
  });
});

describe("registrar", () => {
  const register = (input: Record<string, unknown>, tenant = T) => new RegisterMediaService(repo, storage).execute(tenant, input);

  it("registra lo que REALMENTE quedó en el almacén", async () => {
    const { pathname } = await ticketFor({ kind: "video", fileName: "demo.mp4", contentType: "video/mp4", size: 3 * MB });
    storage.objects.set(pathname, { url: "https://blob.test/demo.mp4", size: 3 * MB, contentType: "video/mp4" });

    const asset = await register({ kind: "video", pathname, fileName: "demo.mp4" });
    expect(asset).toMatchObject({ kind: "video", url: "https://blob.test/demo.mp4", size: 3 * MB, contentType: "video/mp4", fileName: "demo.mp4" });
    expect(await register({ kind: "video", pathname, fileName: "demo.mp4" })).toEqual(asset);
    expect(repo.items).toHaveLength(1);
  });

  it("si lo subido no cumple las reglas, lo borra y no lo registra", async () => {
    const { pathname } = await ticketFor({ kind: "image", fileName: "a.png", contentType: "image/png", size: 100 });
    storage.objects.set(pathname, { url: "https://blob.test/a", size: 100, contentType: "application/x-msdownload" });
    await expect(register({ kind: "image", pathname, fileName: "a.png" })).rejects.toBeInstanceOf(ValidationError);
    expect(storage.removed).toEqual([pathname]);
    expect(repo.items).toHaveLength(0);
  });

  it("no registra rutas de otra cuenta ni subidas que no existen", async () => {
    const { pathname } = await ticketFor({ kind: "image", fileName: "a.png", contentType: "image/png", size: 100 });
    await expect(register({ kind: "image", pathname, fileName: "a.png" }, OTHER)).rejects.toThrow(/no pertenece/);
    await expect(register({ kind: "image", pathname, fileName: "a.png" })).rejects.toThrow(/no terminó de subirse/);
  });
});

describe("almacén local (desarrollo)", () => {
  const dir = mkdtempSync(join(tmpdir(), "auream-media-"));
  let server: Server;
  let base = "";
  let local: LocalMediaStorage;

  const ready = new Promise<void>((resolve) => {
    server = createServer((req, res) => {
      const url = new URL(req.url!, "http://x");
      if (req.method === "PUT") void local.receiveUpload(req, res, url.searchParams.get("ticket") ?? "");
      else void local.serve(res, decodeURIComponent(url.pathname.slice("/media/local/files/".length)));
    }).listen(0, "127.0.0.1", () => {
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      local = new LocalMediaStorage(dir, base);
      resolve();
    });
  });
  afterAll(() => {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const put = (url: string, body: Buffer, contentType: string) =>
    new Promise<number>((resolve) => {
      const req = httpRequest(url, { method: "PUT", headers: { "content-type": contentType } }, (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode ?? 0));
      });
      req.end(body);
    });

  const ticketUrl = async (pathname: string, maxBytes = 1000) => {
    await ready;
    const ticket = await local.createUploadTicket({ pathname, allowedContentTypes: ["image/png"], maxBytes, expiresAt: new Date(Date.now() + 60_000) });
    return ticket.strategy === "direct" ? ticket.uploadUrl : "";
  };

  it("sube con el permiso, describe y sirve el archivo", async () => {
    const pathname = `tenants/${T}/media/33333333-3333-4333-8333-333333333333/a.png`;
    expect(await put(await ticketUrl(pathname), Buffer.from("png-bytes"), "image/png")).toBe(200);
    const described = await local.describe(pathname);
    expect(described).toMatchObject({ size: 9, contentType: "image/png" });
    const served = await fetch(described!.url);
    expect([served.status, served.headers.get("content-type"), await served.text()]).toEqual([200, "image/png", "png-bytes"]);
  });

  it("rechaza permiso alterado, tipo distinto, tamaño mayor y reutilizar el permiso", async () => {
    const pathname = `tenants/${T}/media/44444444-4444-4444-8444-444444444444/b.png`;
    const url = await ticketUrl(pathname, 5);
    expect(await put(url.replace(/ticket=./, "ticket=X"), Buffer.from("x"), "image/png")).toBe(403);
    expect(await put(url, Buffer.from("x"), "image/gif")).toBe(415);
    expect(await put(url, Buffer.from("123456"), "image/png")).toBe(413);
    expect(await put(url, Buffer.from("12"), "image/png")).toBe(200);
    expect(await put(url, Buffer.from("12"), "image/png")).toBe(409);
  });

  it("no sale de su carpeta", async () => {
    await ready;
    expect(await local.describe("../../etc/passwd")).toBeNull();
  });
});
