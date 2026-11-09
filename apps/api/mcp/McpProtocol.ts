import type { McpAccess } from "../../../domains/mcp/domain/McpCredential";
import { DomainError } from "../../../platform/observability/errors/DomainError";
import { invalidArguments, type McpTool } from "./McpTool";

// ---------------------------------------------------------------------------
// El protocolo MCP (JSON-RPC 2.0) del servidor de Auream, sin estado: cada
// petición trae su credencial. Métodos: `initialize`, `ping`, `tools/list`
// (solo las herramientas que la credencial permite) y `tools/call` (vuelve a
// comprobar el permiso). Las notificaciones (`notifications/*`) no responden.
//
// Un error de la herramienta (p. ej. «el contacto no existe») es un RESULTADO
// con `isError` (el agente lo lee y se corrige); un error del protocolo
// (método o parámetros) es un error JSON-RPC.
// ---------------------------------------------------------------------------

export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

export const SERVER_INSTRUCTIONS =
  "Servidor MCP de Auream (automatización de WhatsApp). Todo ocurre dentro de la cuenta de la credencial y solo con sus permisos. " +
  "Busca antes de actuar (list_*), usa los ids que devuelven y confirma con el usuario antes de enviar mensajes o iniciar flujos: le llegan al cliente por WhatsApp.";

export interface JsonRpcResponse {
  readonly jsonrpc: "2.0";
  readonly id: string | number | null;
  readonly result?: unknown;
  readonly error?: { readonly code: number; readonly message: string };
}

export interface ToolCallReport {
  readonly tool: string;
  readonly ok: boolean;
  readonly ms: number;
  readonly error?: string;
}

const error = (id: JsonRpcResponse["id"], code: number, message: string): JsonRpcResponse => ({ jsonrpc: "2.0", id, error: { code, message } });

/** Lo que devuelve una herramienta, como contenido de texto (JSON) y estructurado. */
function toResult(value: unknown) {
  const structured = typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : { result: value };
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: structured };
}

export class McpProtocol {
  public constructor(
    private readonly tools: ReadonlyArray<McpTool>,
    private readonly server: { readonly name: string; readonly version: string },
    private readonly onToolCall: (access: McpAccess, report: ToolCallReport) => void = () => undefined,
    private readonly now: () => number = () => Date.now()
  ) {}

  /** La respuesta a un mensaje, o `null` si es una notificación. */
  public async handle(message: unknown, access: McpAccess): Promise<JsonRpcResponse | null> {
    if (typeof message !== "object" || message === null || (message as { jsonrpc?: unknown }).jsonrpc !== "2.0") return error(null, -32600, "Petición JSON-RPC inválida.");
    const { id, method, params } = message as { id?: string | number | null; method?: unknown; params?: Record<string, unknown> };
    if (typeof method !== "string") return error(id ?? null, -32600, "Falta el método.");
    if (id === undefined) return null;

    switch (method) {
      case "initialize": {
        const requested = typeof params?.["protocolVersion"] === "string" ? params["protocolVersion"] : "";
        const protocolVersion = (SUPPORTED_PROTOCOL_VERSIONS as ReadonlyArray<string>).includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0];
        return { jsonrpc: "2.0", id, result: { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: this.server, instructions: SERVER_INSTRUCTIONS } };
      }
      case "ping":
        return { jsonrpc: "2.0", id, result: {} };
      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: this.allowed(access).map((tool) => ({
              name: tool.name,
              title: tool.title,
              description: tool.description,
              inputSchema: tool.inputSchema,
              annotations: { title: tool.title, readOnlyHint: tool.readOnly, destructiveHint: false, openWorldHint: !tool.readOnly }
            }))
          }
        };
      case "tools/call":
        return this.call(id, params ?? {}, access);
      default:
        return error(id, -32601, `Método no disponible: ${method}.`);
    }
  }

  private allowed(access: McpAccess): McpTool[] {
    return this.tools.filter((tool) => access.scopes.has(tool.scope));
  }

  private async call(id: string | number | null, params: Record<string, unknown>, access: McpAccess): Promise<JsonRpcResponse> {
    const name = params["name"];
    const tool = this.tools.find((candidate) => candidate.name === name);
    if (!tool) return error(id, -32602, `Herramienta desconocida: ${String(name)}.`);
    if (!access.scopes.has(tool.scope)) return error(id, -32602, `La credencial no tiene permiso para «${tool.name}».`);
    const args = typeof params["arguments"] === "object" && params["arguments"] !== null ? (params["arguments"] as Record<string, unknown>) : {};
    const invalid = invalidArguments(tool.inputSchema, args);
    if (invalid) return error(id, -32602, invalid);

    const started = this.now();
    try {
      const value = await tool.run(args, { tenantId: access.tenantId, credentialId: access.credentialId, credentialName: access.credentialName });
      this.onToolCall(access, { tool: tool.name, ok: true, ms: this.now() - started });
      return { jsonrpc: "2.0", id, result: toResult(value) };
    } catch (cause) {
      // Los errores de negocio se explican tal cual; los demás, sin detalles internos.
      const message = cause instanceof DomainError ? cause.message : "No se pudo completar. Inténtalo de nuevo en unos segundos.";
      this.onToolCall(access, { tool: tool.name, ok: false, ms: this.now() - started, error: cause instanceof Error ? cause.message : String(cause) });
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: message }], isError: true } };
    }
  }
}
