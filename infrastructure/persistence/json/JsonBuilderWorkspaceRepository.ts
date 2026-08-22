import { mkdir, readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { BuilderWorkspaceRepository } from "../../../domains/automations/builder/application/BuilderWorkspaceRepository";
import type { PersistedBuilderWorkspace } from "../../../contracts/BuilderContracts";

export class JsonBuilderWorkspaceRepository implements BuilderWorkspaceRepository {
  public constructor(private readonly rootDirectory: string) {}

  public async getWorkspace(tenantId: string, flowKey: string): Promise<PersistedBuilderWorkspace | null> {
    const filePath = this.getFilePath(tenantId, flowKey);

    try {
      const content = await readFile(filePath, "utf-8");
      return JSON.parse(content) as PersistedBuilderWorkspace;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  public async saveWorkspace(workspace: PersistedBuilderWorkspace): Promise<void> {
    const filePath = this.getFilePath(workspace.tenantId, workspace.flowKey);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(workspace, null, 2), "utf-8");
  }

  public async deleteWorkspace(tenantId: string, flowKey: string): Promise<void> {
    const filePath = this.getFilePath(tenantId, flowKey);
    try {
      await unlink(filePath);
    } catch (err) {
      if (err instanceof Error && "code" in err && err.code === "ENOENT") return;
      throw err;
    }
  }

  public async listByTenant(tenantId: string): Promise<PersistedBuilderWorkspace[]> {
    const tenantDir = join(this.rootDirectory, tenantId);
    try {
      const entries = await readdir(tenantDir);
      const flowKeys = entries.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
      const workspaces = await Promise.all(flowKeys.map((key) => this.getWorkspace(tenantId, key)));
      return workspaces.filter((ws): ws is PersistedBuilderWorkspace => ws !== null);
    } catch {
      return [];
    }
  }

  private getFilePath(tenantId: string, flowKey: string): string {
    return join(this.rootDirectory, tenantId, `${flowKey}.json`);
  }
}