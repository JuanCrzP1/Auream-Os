import { createLocalId } from "../_kit/createLocalId";
import type { ToolOutput } from "../ToolDefinition";

// ---------------------------------------------------------------------------
// Salidas de un Distribuidor: forma y operaciones puras.
//
// Vive en la herramienta y no en `contracts/` porque el motor todavía no lee
// esta configuración (`DistributorNodeHandler` es `not_implemented`). Sube a
// `contracts/` sin cambios de forma cuando el motor aprenda a repartir.
// ---------------------------------------------------------------------------

/**
 * Una salida del reparto. `id` es identidad persistida (`fromOutput`): se crea
 * una vez y no se renumera. `label` se guarda en vez de derivarse de la
 * posición para que borrar una salida no renombre a las siguientes.
 */
export type DistributorOutput = ToolOutput;

/**
 * Solo las salidas: la política de reparto (turnos, peso, fijación) no está
 * decidida, y un campo que nadie ejecuta sería una promesa escrita en disco.
 */
export interface DistributorConfig {
  readonly outputs: ReadonlyArray<DistributorOutput>;
}

/** Nace sin salidas: las crea el usuario. */
export const DISTRIBUTOR_DEFAULT_CONFIG: DistributorConfig = { outputs: [] };

/** Identidad utilizable de una salida, o `null`. Regla compartida por lector y validación. */
export function normalizeOutputId(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function labelNumber(label: string): number | null {
  const match = /^Salida\s+(\d+)$/.exec(label.trim());
  if (match === null) return null;

  const value = Number(match[1]);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * Rótulo de la próxima salida. Cuenta desde el MAYOR «Salida n» existente, no
 * desde el total: con «1, 2, 3», borrar la 1 y añadir daría otro «Salida 3».
 */
export function nextOutputLabel(outputs: ReadonlyArray<DistributorOutput>): string {
  const highest = outputs.reduce((max, output) => {
    const value = labelNumber(output.label);
    return value !== null && value > max ? value : max;
  }, 0);

  return `Salida ${highest + 1}`;
}

/** Añade una salida al final. No muta la lista recibida. */
export function addOutput(outputs: ReadonlyArray<DistributorOutput>): DistributorOutput[] {
  return [...outputs, { id: createLocalId("ds"), label: nextOutputLabel(outputs) }];
}

/** Quita una salida por `id` (nunca por posición). Un id ausente no es error. */
export function removeOutput(
  outputs: ReadonlyArray<DistributorOutput>,
  id: string
): DistributorOutput[] {
  return outputs.filter((output) => output.id !== id);
}
