import { beforeEach, describe, expect, it } from "vitest";
import { ImageUploads, isImageInFolder } from "../../domains/media/application/ImageUploads.js";
import type { MediaStorage, StoredObject, UploadPermission } from "../../domains/media/application/ports/MediaStorage.js";
import { ProfileServices } from "../../domains/profiles/application/ProfileServices.js";
import { normalizeDisplayName, normalizePhone, userPhotoFolder } from "../../domains/profiles/domain/UserProfile.js";
import { CompanyServices } from "../../domains/company/application/CompanyServices.js";
import { companyLogoFolder, normalizeTimeZone } from "../../domains/company/domain/Company.js";
import { InMemoryCompanyRepository, InMemoryUserProfileRepository } from "../../infrastructure/persistence/memory/InMemoryAccountRepositories.js";
import { InMemoryRateLimiter } from "../../platform/security/rate-limiting/application/InMemoryRateLimiter.js";
import { ValidationError } from "../../platform/observability/errors/ValidationError.js";
import type { MediaUploadTicket } from "../../contracts/MediaContracts.js";

// ---------------------------------------------------------------------------
// Mi perfil y Empresa: datos validados y guardados, y fotos/logos con las
// garantías de los medios (permiso acotado a la carpeta del dueño, se confía
// en lo que quedó en el almacén y se borra la imagen anterior).
// ---------------------------------------------------------------------------

const U = "11111111-1111-4111-8111-111111111111";
const T = "22222222-2222-4222-8222-222222222222";
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
  /** Simula que el navegador subió el archivo del permiso. */
  public upload(pathname: string, contentType = "image/png", size = MB) {
    this.objects.set(pathname, { url: `https://blob.example/${pathname}`, contentType, size });
  }
}

let storage: FakeStorage;
let profiles: ProfileServices;
let company: CompanyServices;
beforeEach(() => {
  storage = new FakeStorage();
  const images = new ImageUploads(storage, new InMemoryRateLimiter());
  profiles = new ProfileServices(new InMemoryUserProfileRepository(), images);
  company = new CompanyServices(new InMemoryCompanyRepository([{ tenantId: T, name: "Mi espacio", timezone: null, logoPathname: null, logoUrl: null }]), images, "America/Bogota");
});

describe("Mi perfil", () => {
  it("sin editar usa el nombre del registro; guarda nombre y WhatsApp personal normalizados", async () => {
    expect(await profiles.get(U)).toEqual({ displayName: null, phone: null, photoUrl: null });
    const saved = await profiles.update(U, { displayName: "  Juan   Camilo ", phone: "+57 300 123 4567" });
    expect(saved).toEqual({ displayName: "Juan Camilo", phone: "+573001234567", photoUrl: null });
    expect(await profiles.update(U, { phone: "" })).toMatchObject({ displayName: "Juan Camilo", phone: null });
  });

  it.each([
    [() => normalizeDisplayName("   "), "Escribe tu nombre."],
    [() => normalizeDisplayName("x".repeat(81)), "hasta 80"],
    [() => normalizePhone("3001234567"), "prefijo del país"],
    [() => normalizePhone("+0 123"), "prefijo del país"]
  ])("rechaza datos inválidos (%#)", (run, message) => {
    expect(run).toThrow(ValidationError);
    expect(run).toThrow(message);
  });

  it("la foto: permiso solo a SU carpeta, se confía en lo subido y la anterior se borra", async () => {
    const first = await profiles.photoTicket(U, { contentType: "image/png", size: 2 * MB });
    expect(first.pathname).toMatch(new RegExp(`^users/${U}/photo/[0-9a-f-]{36}\\.png$`));
    expect(storage.permissions[0]).toMatchObject({ allowedContentTypes: ["image/png"], maxBytes: 5 * MB });
    storage.upload(first.pathname);
    expect((await profiles.setPhoto(U, { pathname: first.pathname })).photoUrl).toBe(`https://blob.example/${first.pathname}`);

    const second = await profiles.photoTicket(U, { contentType: "image/webp", size: MB });
    storage.upload(second.pathname, "image/webp");
    await profiles.setPhoto(U, { pathname: second.pathname });
    expect(storage.removed).toEqual([first.pathname]);

    expect(await profiles.removePhoto(U)).toMatchObject({ photoUrl: null });
    expect(storage.removed).toEqual([first.pathname, second.pathname]);
  });

  it("rechaza fotos de otra persona, archivos que no son imagen y tamaños de más", async () => {
    const other = await profiles.photoTicket("33333333-3333-4333-8333-333333333333", { contentType: "image/png", size: MB });
    storage.upload(other.pathname);
    await expect(profiles.setPhoto(U, { pathname: other.pathname })).rejects.toThrow("no es de esta cuenta");
    await expect(profiles.photoTicket(U, { contentType: "application/pdf", size: MB })).rejects.toThrow("JPG, PNG o WebP");
    await expect(profiles.photoTicket(U, { contentType: "image/jpeg", size: 6 * MB })).rejects.toThrow("5 MB");

    // El navegador dijo PNG pero subió otra cosa: se borra y no se guarda.
    const ticket = await profiles.photoTicket(U, { contentType: "image/png", size: MB });
    storage.upload(ticket.pathname, "text/html");
    await expect(profiles.setPhoto(U, { pathname: ticket.pathname })).rejects.toThrow(ValidationError);
    expect(storage.removed).toContain(ticket.pathname);
    expect((await profiles.get(U)).photoUrl).toBeNull();
  });

  it("solo reconoce imágenes con la forma de los permisos dentro de la carpeta", () => {
    const folder = userPhotoFolder(U);
    expect(isImageInFolder(folder, `${folder}0b9c2d7e-1111-4222-8333-444455556666.jpg`)).toBe(true);
    expect(isImageInFolder(folder, `${folder}../../tenants/x.jpg`)).toBe(false);
    expect(isImageInFolder(folder, `${folder}0b9c2d7e-1111-4222-8333-444455556666.svg`)).toBe(false);
  });
});

describe("Empresa", () => {
  it("sin zona propia usa la de la plataforma; guarda nombre y zona válidos", async () => {
    expect(await company.get(T, false)).toEqual({ name: "Mi espacio", timezone: "America/Bogota", timezoneIsDefault: true, logoUrl: null, canEdit: false });
    const saved = await company.update(T, { name: " Dilo  Cantando ", timezone: "America/Mexico_City" });
    expect(saved).toMatchObject({ name: "Dilo Cantando", timezone: "America/Mexico_City", timezoneIsDefault: false });
    expect(await company.update(T, { timezone: null })).toMatchObject({ timezone: "America/Bogota", timezoneIsDefault: true });
  });

  it("rechaza zonas que no existen y nombres vacíos", async () => {
    expect(() => normalizeTimeZone("Marte/Olympus")).toThrow("zona horaria");
    await expect(company.update(T, { name: "  " })).rejects.toThrow("nombre de la empresa");
  });

  it("el logo vive en la carpeta de la cuenta y el anterior se borra al cambiarlo", async () => {
    const first = await company.logoTicket(T, { contentType: "image/jpeg", size: MB });
    expect(first.pathname.startsWith(companyLogoFolder(T))).toBe(true);
    storage.upload(first.pathname, "image/jpeg");
    expect((await company.setLogo(T, { pathname: first.pathname })).logoUrl).toContain(first.pathname);
    const second = await company.logoTicket(T, { contentType: "image/png", size: MB });
    storage.upload(second.pathname);
    await company.setLogo(T, { pathname: second.pathname });
    expect(storage.removed).toEqual([first.pathname]);
    expect(await company.removeLogo(T)).toMatchObject({ logoUrl: null });
  });

  it("sin almacén de archivos no hay subidas, pero los datos se guardan igual", async () => {
    const plain = new CompanyServices(new InMemoryCompanyRepository([{ tenantId: T, name: "X", timezone: null, logoPathname: null, logoUrl: null }]), null, "UTC");
    expect(plain.canUploadLogos).toBe(false);
    expect(await plain.update(T, { name: "Y" })).toMatchObject({ name: "Y" });
  });
});
