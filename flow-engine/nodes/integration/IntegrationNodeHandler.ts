import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput, Session } from "../../../contracts/RuntimeContracts";
import { INTEGRATION_OUTPUT, readIntegrationConfig } from "../../../contracts/IntegrationConfig";
import { INTEGRATION_ERROR_VARIABLE } from "../../../contracts/VariableCatalog";
import { identityOf, type ContactDirectory } from "../../ports/ContactDirectory";
import type { HttpRequester } from "../../ports/HttpRequester";
import { templateResolver } from "../../templates/templateResolver";
import type { NodeHandler } from "../NodeHandler";
import { mapResponseFields, runIntegrationRequest } from "./runIntegrationRequest";

// ---------------------------------------------------------------------------
// IntegrationNodeHandler — el bloque «Integración».
//
// Llama al servicio externo con las variables del contacto y la conversación;
// si responde 2xx guarda los datos mapeados en el contacto (y en la
// conversación, para usarlos como `{campo}` en los bloques siguientes) y sale
// por «Éxito». Si no, sale por «Error» con el motivo en el resultado y en
// `{integracion.error}` (en Leona, `{response.erro}`), para avisar o decidir.
//
// El resultado NO incluye cabeceras ni cuerpo enviados: pueden llevar
// credenciales. Solo el host, el estado y los motivos.
// ---------------------------------------------------------------------------

export class IntegrationNodeHandler implements NodeHandler {
  public constructor(
    private readonly http: HttpRequester,
    private readonly contacts: ContactDirectory
  ) {}

  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "integration";
  }

  public async execute(node: FlowNode, input: RuntimeInput, session: Session): Promise<NodeExecutionResult> {
    const config = readIntegrationConfig(node.config);
    const contact = await this.contacts.resolve(session.tenantId, identityOf(input.envelope));
    const run = await runIntegrationRequest(config, templateResolver(input, contact), this.http);
    const host = hostOf(config.url);
    const missingVariableEvents = run.missingVariables.map((name) => `integration_variable_missing:${node.id}:${name}`);

    if (!run.succeeded || !run.response) {
      return {
        executionStatus: "success",
        output: INTEGRATION_OUTPUT.failure,
        outputMessages: [],
        contextPatch: { [INTEGRATION_ERROR_VARIABLE]: run.message || run.reason || "La integración falló." },
        nodeResult: {
          host,
          reason: run.reason,
          message: run.message,
          ...(run.response ? { status: run.response.status } : {}),
          durationMs: run.durationMs
        },
        domainEvents: [`integration_failed:${node.id}:${run.reason}`, ...missingVariableEvents]
      };
    }

    const mapped = mapResponseFields(config.responseMappings, run.response, run.json);
    const saved = Object.keys(mapped.fields);
    if (saved.length > 0) await this.contacts.setFields(session.tenantId, contact.id, mapped.fields);

    return {
      executionStatus: "success",
      output: INTEGRATION_OUTPUT.success,
      outputMessages: [],
      // Un error de una vuelta anterior ya no vale.
      contextPatch: { ...mapped.fields, ...(input.sessionContext[INTEGRATION_ERROR_VARIABLE] ? { [INTEGRATION_ERROR_VARIABLE]: "" } : {}) },
      nodeResult: {
        host,
        status: run.response.status,
        durationMs: run.durationMs,
        savedFields: saved,
        ...(mapped.missingPaths.length > 0 ? { missingPaths: mapped.missingPaths } : {}),
        ...(mapped.invalidFields.length > 0 ? { invalidFields: mapped.invalidFields } : {})
      },
      domainEvents: [
        `integration_succeeded:${node.id}:${run.response.status}`,
        ...mapped.missingPaths.map((path) => `integration_path_not_found:${node.id}:${path}`),
        ...missingVariableEvents
      ]
    };
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}
