// ---------------------------------------------------------------------------
// Distribuidor — contrato de configuración compartido por el builder (editor)
// y el motor (DistributorNodeHandler). Reparte por turnos entre sus salidas.
// ---------------------------------------------------------------------------

export interface DistributorOutput {
  readonly id: string;
  readonly label: string;
}

export interface DistributorConfig {
  readonly outputs: ReadonlyArray<DistributorOutput>;
}

export const DISTRIBUTOR_DEFAULT_CONFIG: DistributorConfig = { outputs: [] };

/** Un id de salida usable (texto no vacío) o `null`. */
export function normalizeOutputId(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Salidas del Distribuidor en su orden, sin repetir id. El orden ES el orden
 * de los turnos. Una etiqueta vacía se muestra como «Salida n».
 */
export function readDistributorOutputs(config: Readonly<Record<string, unknown>>): DistributorOutput[] {
  const raw = config.outputs;
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const outputs: DistributorOutput[] = [];

  raw.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null) return;

    const record = entry as Record<string, unknown>;
    const id = normalizeOutputId(record.id);
    if (id === null || seen.has(id)) return;
    seen.add(id);

    const label = typeof record.label === "string" ? record.label.trim() : "";
    outputs.push({ id, label: label.length > 0 ? label : `Salida ${index + 1}` });
  });

  return outputs;
}
