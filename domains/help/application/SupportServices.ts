import type { SupportCase, SupportCaseStatus, SupportSettings } from "../../../contracts/HelpContracts";
import { AccessError } from "../../../platform/authorization/domain/AccessError";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { requireSupportCase, requireSupportSettings } from "../domain/HelpRules";
import type { SupportRepository } from "./HelpPorts";
import type { HelpViewer } from "./HelpServices";

// ---------------------------------------------------------------------------
// Soporte: cada cuenta abre casos (con la pantalla desde donde escribe y, si
// quiere, una captura) y ve sus respuestas; el equipo de Auream los responde y
// configura cómo contactar a soporte (WhatsApp, correo, horario, tiempo de
// respuesta).
// ---------------------------------------------------------------------------

const STATUSES: ReadonlyArray<SupportCaseStatus> = ["open", "answered", "closed"];

export class SupportServices {
  public constructor(
    private readonly repository: SupportRepository,
    private readonly newId: () => string,
    private readonly now: () => Date = () => new Date()
  ) {}

  public settings(): Promise<SupportSettings> {
    return this.repository.settings();
  }

  public async saveSettings(viewer: HelpViewer, body: unknown): Promise<SupportSettings> {
    this.requireManager(viewer);
    const settings = requireSupportSettings(body);
    await this.repository.saveSettings(settings);
    return settings;
  }

  public async open(viewer: HelpViewer, body: unknown): Promise<ReadonlyArray<SupportCase>> {
    const input = requireSupportCase(body);
    await this.repository.createCase(viewer.tenantId, viewer.userId, this.newId(), input);
    return this.repository.casesOf(viewer.tenantId, viewer.userId);
  }

  public mine(viewer: HelpViewer): Promise<ReadonlyArray<SupportCase>> {
    return this.repository.casesOf(viewer.tenantId, viewer.userId);
  }

  public async all(viewer: HelpViewer, status: string | null): Promise<ReadonlyArray<SupportCase>> {
    this.requireManager(viewer);
    return this.repository.allCases(STATUSES.includes(status as SupportCaseStatus) ? (status as SupportCaseStatus) : null, 200);
  }

  public async reply(viewer: HelpViewer, id: string, body: unknown): Promise<void> {
    this.requireManager(viewer);
    const input = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const text = typeof input["reply"] === "string" ? input["reply"].trim().slice(0, 4000) : "";
    const status = STATUSES.includes(input["status"] as SupportCaseStatus) ? (input["status"] as SupportCaseStatus) : "answered";
    if (!text && status !== "closed") throw new ValidationError("Escribe la respuesta.");
    if (!(await this.repository.reply(id, text, status, this.now()))) throw new NotFoundError("Ese caso no existe.");
  }

  private requireManager(viewer: HelpViewer): void {
    if (!viewer.canManage) throw new AccessError("Solo el equipo de Auream administra soporte.");
  }
}
