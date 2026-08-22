import { readdir, readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { AutomationRepository } from "../../../domains/automations/catalog/application/AutomationRepository";
import type { AutomationFlow } from "../../../domains/automations/catalog/domain/AutomationFlow";
import { isAutomationFlow } from "./parseAutomationFlow";

/**
 * JsonAutomationRepository — implementación filesystem de AutomationRepository.
 *
 * Persiste cada flow como un fichero JSON en:
 *   {rootDirectory}/{tenantId}/flows/{flowId}.json
 *
 * Sólo para desarrollo local. En producción, reemplazar por implementación
 * de base de datos sin cambiar la interfaz ni los servicios de aplicación.
 */
export class JsonAutomationRepository implements AutomationRepository {
  public constructor(private readonly rootDirectory: string) {}

  public async findByTenant(tenantId: string): Promise<AutomationFlow[]> {
    const dir = this.tenantDir(tenantId);
    try {
      const entries = await readdir(dir);
      const jsonFiles = entries.filter((f) => f.endsWith(".json"));
      const results = await Promise.all(
        jsonFiles.map((file) => this.readFlow(join(dir, file)))
      );
      return results.filter((f): f is AutomationFlow => f !== null);
    } catch (err) {
      if (this.isNotFound(err)) return [];
      throw err;
    }
  }

  public async findById(tenantId: string, id: string): Promise<AutomationFlow | undefined> {
    const filePath = this.flowPath(tenantId, id);
    const flow = await this.readFlow(filePath);
    return flow ?? undefined;
  }

  public async save(flow: AutomationFlow): Promise<void> {
    const filePath = this.flowPath(flow.tenantId, flow.id);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(flow, null, 2), "utf-8");
  }

  public async delete(tenantId: string, id: string): Promise<void> {
    const filePath = this.flowPath(tenantId, id);
    try {
      await unlink(filePath);
    } catch (err) {
      if (this.isNotFound(err)) return;
      throw err;
    }
  }

  private async readFlow(filePath: string): Promise<AutomationFlow | null> {
    try {
      const content = await readFile(filePath, "utf-8");
      const parsed: unknown = JSON.parse(content);

      // Un fichero corrupto o de un formato antiguo se ignora en lugar de
      // entrar en el dominio con una forma que nadie ha comprobado.
      return isAutomationFlow(parsed) ? parsed : null;
    } catch (err) {
      if (this.isNotFound(err)) return null;
      throw err;
    }
  }

  private tenantDir(tenantId: string): string {
    return join(this.rootDirectory, tenantId, "flows");
  }

  private flowPath(tenantId: string, id: string): string {
    return join(this.tenantDir(tenantId), `${id}.json`);
  }

  private isNotFound(err: unknown): boolean {
    return err instanceof Error && "code" in err && err.code === "ENOENT";
  }
}
