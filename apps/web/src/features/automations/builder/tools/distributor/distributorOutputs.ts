import { createLocalId } from "../_kit/createLocalId";

// ---------------------------------------------------------------------------
// Salidas de un Distribuidor: operaciones del editor (añadir, quitar, rotular).
//
// La FORMA de una salida es el contrato compartido con el motor
// (`contracts/DistributorConfig.ts`): `id` es identidad persistida
// (`fromOutput`) y no se renumera; `label` se guarda para que borrar una
// salida no renombre a las siguientes.
// ---------------------------------------------------------------------------

export {
  DISTRIBUTOR_DEFAULT_CONFIG,
  normalizeOutputId,
  type DistributorConfig,
  type DistributorOutput
} from "@contracts/DistributorConfig";
import type { DistributorOutput } from "@contracts/DistributorConfig";

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
