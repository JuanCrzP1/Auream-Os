import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { DEFAULT_LABEL_COLOR } from "../../../contracts/ContactContracts";
import { MAX_LABEL_NAME, isValidLabelColor, normalizeLabelName } from "../domain/Label";

/** Nombre de etiqueta válido (normalizado) o `ValidationError`. */
export function requireLabelName(name: unknown): string {
  const normalized = typeof name === "string" ? normalizeLabelName(name) : "";
  if (normalized.length === 0) throw new ValidationError("La etiqueta necesita un nombre.");
  if (normalized.length > MAX_LABEL_NAME) throw new ValidationError(`El nombre de la etiqueta no puede pasar de ${MAX_LABEL_NAME} caracteres.`);
  return normalized;
}

/** Color válido (o el de por defecto si no se indicó) o `ValidationError`. */
export function requireLabelColor(color: unknown): string {
  if (color === undefined) return DEFAULT_LABEL_COLOR;
  if (typeof color !== "string" || !isValidLabelColor(color)) throw new ValidationError("El color debe tener la forma #rrggbb.");
  return color.toLowerCase();
}
