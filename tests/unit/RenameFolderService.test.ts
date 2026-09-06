import { describe, it, expect, beforeEach } from "vitest";
import { RenameFolderService } from "../../domains/automations/catalog/application/RenameFolderService.js";
import type { FolderRepository } from "../../domains/automations/catalog/application/FolderRepository.js";
import type { AutomationFolder } from "../../domains/automations/catalog/domain/AutomationFolder.js";

// ---------------------------------------------------------------------------
// RENOMBRAR UNA CARPETA.
//
// El catálogo sabía crearlas pero no cambiarles el nombre: el puerto ya lo
// permitía y no había caso de uso. Aquí se fijan sus reglas, que son las que
// la interfaz no puede garantizar.
// ---------------------------------------------------------------------------

class RepoCarpetas implements FolderRepository {
  escrituras: AutomationFolder[] = [];
  constructor(private items: AutomationFolder[] = []) {}
  async findByTenant(t: string) { return this.items.filter((f) => f.tenantId === t); }
  async findById(t: string, id: string) { return this.items.find((f) => f.tenantId === t && f.id === id); }
  async save(folder: AutomationFolder) {
    this.escrituras.push(folder);
    const i = this.items.findIndex((f) => f.tenantId === folder.tenantId && f.id === folder.id);
    if (i >= 0) this.items[i] = folder; else this.items.push(folder);
  }
}

const TENANT = "tenant-1";
const OTRO = "tenant-2";
const carpeta = (id: string, name: string, tenantId = TENANT): AutomationFolder => ({
  id, tenantId, name, createdAt: "2026-01-01T00:00:00.000Z"
});

describe("renombrar una carpeta", () => {
  let repo: RepoCarpetas;
  let sut: RenameFolderService;

  beforeEach(() => {
    repo = new RepoCarpetas([carpeta("c1", "Ventas"), carpeta("ajena", "De otro", OTRO)]);
    sut = new RenameFolderService(repo);
  });

  it("cambia el nombre y conserva lo demás", async () => {
    await sut.execute(TENANT, "c1", "Clientes VIP");

    const guardada = await repo.findById(TENANT, "c1");
    expect(guardada?.name).toBe("Clientes VIP");
    expect(guardada?.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("recorta los espacios de los extremos", async () => {
    // La regla es del dominio: otro cliente de la API no puede saltársela.
    await sut.execute(TENANT, "c1", "   Con espacios   ");

    expect((await repo.findById(TENANT, "c1"))?.name).toBe("Con espacios");
  });

  it("el mismo nombre no genera escritura", async () => {
    await sut.execute(TENANT, "c1", "Ventas");

    expect(repo.escrituras).toHaveLength(0);
  });

  it("un nombre en blanco se rechaza", async () => {
    await expect(sut.execute(TENANT, "c1", "   ")).rejects.toThrow();
    expect(repo.escrituras).toHaveLength(0);
  });

  it("una carpeta inexistente falla sin tocar nada", async () => {
    await expect(sut.execute(TENANT, "no-existe", "Da igual")).rejects.toThrow();
    expect(repo.escrituras).toHaveLength(0);
  });

  it("no se puede renombrar la carpeta de otro tenant", async () => {
    await expect(sut.execute(TENANT, "ajena", "Secuestrada")).rejects.toThrow();

    expect(repo.escrituras).toHaveLength(0);
    expect((await repo.findById(OTRO, "ajena"))?.name).toBe("De otro");
  });
});
