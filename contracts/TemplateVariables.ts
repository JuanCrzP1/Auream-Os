// ---------------------------------------------------------------------------
// Variables en plantillas — UNA sola definición para el builder y el motor.
//
// Sintaxis: `{nombre}`. `nombre` es una variable del sistema (`full_name`,
// `phone`…), un campo personalizado del contacto o un dato que el flujo guardó
// en la conversación. Con valor por defecto si falta: `{first_name|amigo}`.
// Se admite el formato heredado `{{context.clave}}`.
//
// Al sustituir se CODIFICA según dónde va el texto: una variable dentro de una
// URL, de un JSON o de una cabecera no puede romper (ni inyectar) su formato.
// ---------------------------------------------------------------------------

/** Variable del sistema: siempre disponible, la resuelve el motor. */
export interface BuiltInVariable {
  readonly name: string;
  readonly label: string;
  /** Valor de ejemplo para vistas previas y pruebas desde el editor. */
  readonly sample: string;
}

export const BUILT_IN_VARIABLES: ReadonlyArray<BuiltInVariable> = [
  { name: "first_name", label: "Nombre", sample: "Laura" },
  { name: "full_name", label: "Nombre completo", sample: "Laura Gómez" },
  { name: "phone", label: "Teléfono", sample: "573001234567" },
  { name: "email", label: "Correo", sample: "laura@correo.com" },
  { name: "last_message", label: "Último mensaje", sample: "Quiero más información" },
  // Del reloj, en la zona del negocio. Un campo o dato del flujo con el mismo nombre manda.
  { name: "fecha", label: "Fecha", sample: "09/11/2026" },
  { name: "hora", label: "Hora", sample: "14:35" }
];

/** Mismo formato que la clave de un campo personalizado del contacto. */
// Admite guion, como Leona: `{resposta-lead}`.
const VARIABLE = /\{\{\s*context\.([A-Za-z0-9_-]+)\s*\}\}|\{([A-Za-z_][A-Za-z0-9_.-]{0,63})(?:\|([^{}\r\n]{0,100}))?\}/g;

/**
 * Dónde se inserta el valor:
 *   text    tal cual (mensajes)
 *   url     codificado como componente de URL
 *   json    escapado para ir dentro de una cadena JSON
 *   header  sin saltos de línea (no se pueden inyectar cabeceras)
 */
export type TemplateEncoding = "text" | "url" | "json" | "header";

/** Valor de una variable, o `undefined` si no existe. */
export type VariableResolver = (name: string) => unknown;

export interface RenderedTemplate {
  readonly text: string;
  /** Variables sin valor ni valor por defecto: quedaron vacías. */
  readonly missing: ReadonlyArray<string>;
}

function stringify(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function encode(value: string, encoding: TemplateEncoding): string {
  switch (encoding) {
    case "url":
      return encodeURIComponent(value);
    case "json":
      return JSON.stringify(value).slice(1, -1);
    case "header":
      return value.replace(/[\r\n]+/g, " ");
    default:
      return value;
  }
}

export function renderTemplate(template: string, resolve: VariableResolver, encoding: TemplateEncoding = "text"): RenderedTemplate {
  const missing: string[] = [];
  const text = template.replace(VARIABLE, (_match, legacy: string | undefined, name: string | undefined, fallback: string | undefined) => {
    const key = (legacy ?? name)!;
    const resolved = stringify(resolve(key));
    const value = resolved === undefined || resolved === "" ? (fallback !== undefined ? fallback.trim() : resolved) : resolved;
    if (value === undefined) {
      if (!missing.includes(key)) missing.push(key);
      return "";
    }
    return encode(value, encoding);
  });
  return { text, missing };
}

/** Nombres de las variables que usa una plantilla, sin repetir. */
export function variablesIn(template: string): string[] {
  const names: string[] = [];
  for (const match of template.matchAll(VARIABLE)) {
    const name = (match[1] ?? match[2])!;
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

/** Resolutor con los valores de ejemplo (más los que se pasen). */
export function sampleResolver(overrides: Readonly<Record<string, string>> = {}): VariableResolver {
  const samples = Object.fromEntries(BUILT_IN_VARIABLES.map((variable) => [variable.name, variable.sample]));
  return (name) => overrides[name] ?? samples[name];
}
