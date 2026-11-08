import { readIntegrationConfig } from "../../../contracts/IntegrationConfig";
import type { IntegrationTestResult } from "../../../contracts/IntegrationTestContracts";
import { sampleResolver } from "../../../contracts/TemplateVariables";
import type { IntegrationRequestTester } from "../../../domains/automations/builder/application/ports/IntegrationRequestTester";
import type { HttpRequester } from "../../../flow-engine/ports/HttpRequester";
import { mapResponseFields, runIntegrationRequest } from "../../../flow-engine/nodes/integration/runIntegrationRequest";
import { listResponsePaths } from "../../../flow-engine/nodes/integration/responsePaths";

// ---------------------------------------------------------------------------
// Adaptador del puerto `IntegrationRequestTester` sobre el motor: la prueba
// del editor recorre EXACTAMENTE el mismo código que el bloque en un flujo
// (`runIntegrationRequest` + `mapResponseFields`), con valores de ejemplo.
// ---------------------------------------------------------------------------

const MAX_BODY_PREVIEW = 20_000;

export class EngineIntegrationRequestTester implements IntegrationRequestTester {
  public constructor(private readonly http: HttpRequester) {}

  public async test(config: Readonly<Record<string, unknown>>, variables: Readonly<Record<string, string>>): Promise<IntegrationTestResult> {
    const integration = readIntegrationConfig(config);
    const run = await runIntegrationRequest(integration, sampleResolver(variables), this.http);
    const response = run.response;
    const mapped = response
      ? mapResponseFields(integration.responseMappings, response, run.json)
      : { fields: {}, missingPaths: [], invalidFields: [] };
    const body = response?.body ?? "";
    const contentType = response?.headers["content-type"];

    return {
      succeeded: run.succeeded,
      ...(run.reason ? { reason: run.reason } : {}),
      ...(run.message ? { message: run.message } : {}),
      ...(response ? { status: response.status } : {}),
      durationMs: run.durationMs,
      ...(contentType ? { contentType } : {}),
      ...(response ? { bodyPreview: body.slice(0, MAX_BODY_PREVIEW) } : {}),
      bodyTruncated: body.length > MAX_BODY_PREVIEW,
      paths: run.json !== undefined ? listResponsePaths(run.json) : [],
      mapped: mapped.fields,
      missingPaths: mapped.missingPaths,
      missingVariables: run.missingVariables
    };
  }
}
