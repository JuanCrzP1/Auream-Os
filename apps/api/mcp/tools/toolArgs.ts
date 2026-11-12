// ---------------------------------------------------------------------------
// Lectura de los argumentos de una herramienta MCP. El protocolo ya validó los
// tipos contra el esquema (`invalidArguments`); aquí solo se toma cada valor
// con su forma, sin repetir `typeof` en cada herramienta. Lo que falta queda
// `undefined` para que el servicio de la aplicación aplique sus reglas.
// ---------------------------------------------------------------------------

export type ToolArgs = Readonly<Record<string, unknown>>;

/** Texto recortado; `undefined` si no vino o está vacío. */
export function textArg(args: ToolArgs, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

/** Texto obligatorio (el esquema ya exige que venga). */
export function requiredText(args: ToolArgs, key: string): string {
  return String(args[key] ?? "").trim();
}

export function numberArg(args: ToolArgs, key: string): number | undefined {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function booleanArg(args: ToolArgs, key: string): boolean | undefined {
  const value = args[key];
  return typeof value === "boolean" ? value : undefined;
}

export function stringListArg(args: ToolArgs, key: string): string[] | undefined {
  const value = args[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : undefined;
}

/** Quita las claves `undefined` (para no pisar con «vacío» lo que no se pidió cambiar). */
export function defined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}
