import type { LabelDuplicate, LabelUse } from "../../../contracts/LabelManagementContracts";
import { labelKey, normalizeLabelName } from "../../contacts/domain/Label";

// ---------------------------------------------------------------------------
// Reglas de Etiquetas: cuáles están repetidas (se leen igual) y cuál se queda
// al unirlas, y cuándo se puede unir una en otra o borrarla sin romper nada.
// Puro.
// ---------------------------------------------------------------------------

export interface LabelFacts {
  readonly id: string;
  readonly name: string;
  readonly contactCount: number;
  readonly uses: ReadonlyArray<LabelUse>;
}

const stageOf = (label: LabelFacts) => label.uses.find((use): use is Extract<LabelUse, { kind: "stage" }> => use.kind === "stage") ?? null;

/** Cuál se queda: la etapa del CRM, si no la que no tiene caracteres raros, y si no la de más clientes. */
function keeper(group: ReadonlyArray<LabelFacts>): LabelFacts {
  return [...group].sort(
    (a, b) =>
      Number(Boolean(stageOf(b))) - Number(Boolean(stageOf(a))) ||
      Number(normalizeLabelName(b.name) === b.name) - Number(normalizeLabelName(a.name) === a.name) ||
      b.contactCount - a.contactCount
  )[0]!;
}

/** Las que se leen igual («Pagado», «pagado», «‎Pagado»), con la que se propone conservar. Dos etapas no se proponen unir. */
export function duplicatesOf(labels: ReadonlyArray<LabelFacts>): LabelDuplicate[] {
  const groups = new Map<string, LabelFacts[]>();
  for (const label of labels) groups.set(labelKey(label.name), [...(groups.get(labelKey(label.name)) ?? []), label]);
  const duplicates: LabelDuplicate[] = [];
  for (const group of groups.values()) {
    if (group.length < 2 || group.filter((label) => stageOf(label)).length > 1) continue;
    const keep = keeper(group);
    duplicates.push({ name: normalizeLabelName(keep.name), keepId: keep.id, otherIds: group.filter((label) => label.id !== keep.id).map((label) => label.id) });
  }
  return duplicates;
}

/**
 * ¿Se puede unir `from` en `into`? `null` si sí; si no, por qué. Una etapa del
 * CRM no se une en otra etiqueta: el embudo perdería esa etapa (se cambia en
 * CRM). Sí se puede unir una cualquiera EN una etapa: sus clientes pasan a
 * esa etapa, como si un flujo les pusiera la etiqueta.
 */
export function mergeProblem(from: LabelFacts, into: LabelFacts): string | null {
  if (from.id === into.id) return "Elige otra etiqueta: no se puede unir consigo misma.";
  const stage = stageOf(from);
  if (stage) {
    return `«${from.name}» es una etapa del embudo «${stage.pipelineName}». Únela al revés (pasa «${into.name}» a «${from.name}») o cámbiala en CRM › Embudos.`;
  }
  return null;
}

/**
 * ¿Se puede borrar sin pasar sus usos a otra? Una etapa no (el embudo la
 * perdería) y una que usan flujos, difusiones o webhooks tampoco: los flujos
 * la volverían a crear y lo demás dejaría de funcionar. Sus clientes solo la
 * pierden.
 */
export function deleteProblem(label: LabelFacts): string | null {
  const stage = stageOf(label);
  if (stage) return `«${label.name}» es una etapa del embudo «${stage.pipelineName}». Pasa sus clientes a otra etiqueta o quítala del embudo en CRM.`;
  if (label.uses.length > 0) return `«${label.name}» se usa en otras partes: elige a qué etiqueta pasar sus clientes y sus usos.`;
  return null;
}
