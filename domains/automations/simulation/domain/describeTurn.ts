import type { BuilderFlowSnapshot } from "../../../../contracts/FlowSnapshot";
import type { OutboundMessage } from "../../../../contracts/RuntimeContracts";
import type { SimulatedMessage, SimulationStep } from "../../../../contracts/SimulationContracts";
import { blockOutputs } from "../../../../contracts/blocks/blockCatalog";
import type { JournalRecord } from "./SimulationJournal";

// ---------------------------------------------------------------------------
// Lo que pasó en un turno de prueba, para mostrarlo: cada bloque con la salida
// por la que siguió (con su nombre visible) y lo que hizo en lenguaje claro, y
// lo que se le habría mandado al cliente. Puro.
// ---------------------------------------------------------------------------

const MAX_VALUE = 80;

/** Las claves que el motor usa por dentro (`__wake`…) no son variables del usuario. */
export const isInternalKey = (key: string): boolean => key.startsWith("__");

function show(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE)}…` : text;
}

const EVENT_NOTES: ReadonlyArray<readonly [RegExp, (match: RegExpMatchArray) => string]> = [
  [/^question_prompted:/, () => "Espera la respuesta del cliente"],
  [/^menu_prompted:/, () => "Espera que el cliente elija una opción"],
  [/^menu_other_reply:/, () => "La respuesta no es una de las opciones"],
  [/^(question|menu)_timed_out:/, () => "Se acabó el tiempo de espera"],
  [/^delay_node_scheduled:/, () => "Programado: continúa más tarde"],
  [/^delay_(resumed|elapsed):/, () => "Terminó la espera del Programador"],
  [/^notification_skipped:/, () => "No avisó al equipo: falta un número válido"],
  [/_variable_missing:[^:]+:(.+)$/, (match) => `Variable sin valor: {${match[1]}}`],
  [/^distributor_without_outputs:/, () => "El Distribuidor no tiene salidas"]
];

function eventNotes(events: ReadonlyArray<string>): string[] {
  const notes: string[] = [];
  for (const event of events) {
    const rule = EVENT_NOTES.find(([pattern]) => pattern.test(event));
    if (rule) notes.push(rule[1](event.match(rule[0])!));
  }
  return notes;
}

function failureNote(record: JournalRecord): string[] {
  const failed = record.result.domainEvents.some((event) => /_failed:/.test(event)) || record.result.executionStatus === "failed";
  const message = record.result.nodeResult["message"];
  return failed && typeof message === "string" && message.trim() ? [`Error: ${message.trim()}`] : [];
}

export function describeSteps(draft: BuilderFlowSnapshot, records: ReadonlyArray<JournalRecord>): SimulationStep[] {
  return records.map((record) => {
    const node = draft.nodes[record.nodeId];
    const outputId = record.result.output ?? null;
    const label = outputId && node ? (blockOutputs(node.type, node.config)?.find((output) => output.id === outputId)?.label ?? outputId) : null;
    const saved = Object.entries(record.result.contextPatch)
      .filter(([key]) => !isInternalKey(key))
      .map(([key, value]) => `Guardó {${key}} = ${show(value)}`);
    return {
      nodeId: record.nodeId,
      nodeName: node?.name ?? record.nodeId,
      nodeType: node?.type ?? "desconocido",
      status: record.result.executionStatus,
      output: outputId && label ? { id: outputId, label } : null,
      notes: [...record.notes, ...saved, ...eventNotes(record.result.domainEvents), ...failureNote(record)]
    };
  });
}

function toMessage(nodeId: string, message: OutboundMessage): SimulatedMessage | null {
  // La presencia de una espera larga la muestra el aviso de espera (no es una pausa de este turno).
  if (message.kind === "presence") return null;
  if (message.kind === "pause") {
    const delayMs = Math.max(0, message.delayMs ?? 0);
    return delayMs > 0 ? { nodeId, kind: "pause", text: "", delayMs, ...(message.presence ? { presence: message.presence } : {}) } : null;
  }
  if (message.recipient) return { nodeId, kind: "notification", text: message.content, recipient: { name: message.recipient.name, phone: message.recipient.phone } };
  if (message.kind === "reaction") return { nodeId, kind: "reaction", text: message.content };
  if (message.kind === "media" && message.media) return { nodeId, kind: "media", text: message.content, media: { ...message.media } };
  if (message.interactive) {
    const menu = message.interactive;
    return {
      nodeId,
      kind: "menu",
      text: menu.body,
      menu: {
        format: menu.type,
        ...(menu.header ? { header: menu.header } : {}),
        ...(menu.footer ? { footer: menu.footer } : {}),
        ...(menu.buttonLabel ? { buttonLabel: menu.buttonLabel } : {}),
        options: menu.options.map((option) => ({ id: option.id, title: option.title, ...(option.description ? { description: option.description } : {}) }))
      }
    };
  }
  return { nodeId, kind: "text", text: message.content };
}

/** Lo que el flujo habría mandado, en orden, con sus pausas («escribiendo…» incluido). */
export function describeMessages(records: ReadonlyArray<JournalRecord>): SimulatedMessage[] {
  return records.flatMap((record) => record.result.outputMessages.map((message) => toMessage(record.nodeId, message)).filter((item): item is SimulatedMessage => item !== null));
}
