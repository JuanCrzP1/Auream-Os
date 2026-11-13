import { coerceFieldValue, mismatchMessage, type TypedField } from "../../../contracts/FieldValues";
import { WAIT_RESPONSE_MAX_RETRIES, type WaitResponseConfig } from "../../../contracts/WaitResponseConfig";
import type { ContactFieldCatalog } from "../../ports/ContactFieldCatalog";

// ---------------------------------------------------------------------------
// ¿La respuesta encaja en el campo donde se guarda? Esperar respuesta con
// «Preguntar de nuevo» (`onMismatch: "retry"`) y un campo con tipo:
//
//   encaja                → sigue
//   no encaja, quedan     → vuelve a preguntar (`retry`)
//   no encaja, se acabó   → sigue y lo que escribió queda solo en la
//                           conversación (`gave_up`)
//
// Un campo de texto (o una clave que no es campo) siempre encaja. Si es una
// LISTA, lo que se guarda es la opción bien escrita («bogota» → «Bogotá»): la
// conversación y la ficha dicen lo mismo. Lo demás se guarda como lo escribió
// (un «1.200.000» no se vuelve «1200000» en un mensaje).
// ---------------------------------------------------------------------------

export type AnswerFit =
  | { readonly kind: "fits"; readonly value: string }
  | { readonly kind: "retry"; readonly attempt: number; readonly message: string }
  | { readonly kind: "gave_up"; readonly field: TypedField };

export async function answerFit(
  config: WaitResponseConfig,
  key: string | null,
  answer: string,
  attemptsSoFar: number,
  catalog: { readonly tenantId: string; readonly fields: ContactFieldCatalog }
): Promise<AnswerFit> {
  if (!key) return { kind: "fits", value: answer };
  const field = await catalog.fields.find(catalog.tenantId, key);
  const typed = field ? coerceFieldValue(field, answer) : undefined;
  const value = field?.type === "list" && typeof typed === "string" ? typed : answer;
  if (config.onMismatch !== "retry" || !field || field.type === "text" || typed !== undefined) return { kind: "fits", value };
  if (attemptsSoFar >= WAIT_RESPONSE_MAX_RETRIES) return { kind: "gave_up", field };
  return { kind: "retry", attempt: attemptsSoFar + 1, message: mismatchMessage(field) };
}

/** Los intentos ya hechos, como los guardó la conversación (cualquier cosa rara cuenta como 0). */
export function attemptsOf(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 0;
}
