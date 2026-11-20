import type { Scope } from "../../../platform/authorization/contracts/Scope";

// ---------------------------------------------------------------------------
// Una herramienta del servidor MCP: lo que el agente ve (nombre, descripción,
// esquema de entrada) y el permiso que exige. `run` usa los MISMOS servicios
// de la aplicación que la web (no hay lógica de negocio aquí).
// ---------------------------------------------------------------------------

export interface McpToolContext {
  readonly tenantId: string;
  readonly credentialId: string;
  readonly credentialName: string;
  /** Los permisos de la credencial (para mostrar solo lo que puede ver, p. ej. la plata). */
  readonly scopes?: ReadonlySet<string>;
}

/** Esquema JSON de la entrada (subconjunto: objeto con propiedades simples). */
export interface McpInputSchema {
  readonly type: "object";
  readonly properties: Readonly<Record<string, { readonly type: "string" | "number" | "integer" | "boolean" | "array" | "object"; readonly description: string; readonly items?: { readonly type: "string" | "object" }; readonly enum?: ReadonlyArray<string> }>>;
  readonly required?: ReadonlyArray<string>;
}

export interface McpTool {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  /** `null`: no toca datos de la cuenta (p. ej. la documentación) y la ve cualquier credencial. */
  readonly scope: Scope | null;
  /** Otros permisos que también exige (p. ej. ver los miembros de un grupo pide además contactos y ventas). */
  readonly alsoRequires?: ReadonlyArray<Scope>;
  readonly inputSchema: McpInputSchema;
  /** Solo lee (el agente puede usarla sin pedir confirmación). */
  readonly readOnly: boolean;
  run(args: Readonly<Record<string, unknown>>, context: McpToolContext): Promise<unknown>;
}

/** La credencial tiene todos los permisos que la herramienta exige. */
export function canUse(tool: Pick<McpTool, "scope" | "alsoRequires">, scopes: ReadonlySet<string>): boolean {
  return [...(tool.scope === null ? [] : [tool.scope]), ...(tool.alsoRequires ?? [])].every((scope) => scopes.has(scope));
}

/** `null` si los argumentos cumplen el esquema; si no, por qué. */
export function invalidArguments(schema: McpInputSchema, args: Readonly<Record<string, unknown>>): string | null {
  for (const name of schema.required ?? []) {
    if (args[name] === undefined || args[name] === null || args[name] === "") return `Falta «${name}».`;
  }
  for (const [name, value] of Object.entries(args)) {
    const property = schema.properties[name];
    if (!property || value === undefined || value === null) continue;
    const ok =
      property.type === "array" ? Array.isArray(value) && (property.items?.type !== "string" || value.every((item) => typeof item === "string"))
      : property.type === "integer" ? Number.isInteger(value)
      : property.type === "object" ? typeof value === "object" && !Array.isArray(value)
      : typeof value === property.type;
    if (!ok) return `«${name}» debe ser de tipo ${property.type}.`;
    if (property.enum && !property.enum.includes(String(value))) return `«${name}» debe ser uno de: ${property.enum.join(", ")}.`;
  }
  return null;
}
