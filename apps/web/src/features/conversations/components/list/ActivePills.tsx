import type { ChatAgent } from "@contracts/ConversationContracts";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import type { LabelSummary } from "@contracts/ContactContracts";
import { dateLabel, type InboxFilters } from "../../model/inboxFilters";
import { CloseGlyph } from "../ChatGlyphs";

/** Los filtros del panel que están puestos, cada uno con su ✕ para quitarlo. */
export function ActivePills({
  filters,
  connections,
  labels,
  agents,
  onChange
}: {
  readonly filters: InboxFilters;
  readonly connections: ReadonlyArray<ConnectionSummary>;
  readonly labels: ReadonlyArray<LabelSummary>;
  readonly agents: ReadonlyArray<ChatAgent>;
  readonly onChange: (next: Partial<InboxFilters>) => void;
}) {
  const pills: Array<{ key: string; text: string; color?: string; remove: () => void }> = [];
  const connection = connections.find((item) => item.id === filters.connectionId);
  if (filters.connectionId) pills.push({ key: "connection", text: connection?.name ?? "Número", remove: () => onChange({ connectionId: "" }) });
  if (filters.assigneeId) {
    const agent = agents.find((item) => item.userId === filters.assigneeId);
    pills.push({ key: "assignee", text: filters.assigneeId === "none" ? "Sin asignar" : (agent?.name ?? "Responsable"), remove: () => onChange({ assigneeId: "" }) });
  }
  for (const id of filters.labelIds) {
    const label = labels.find((item) => item.id === id);
    pills.push({
      key: `label-${id}`,
      text: label?.name ?? "Etiqueta",
      ...(label ? { color: label.color } : {}),
      remove: () => onChange({ labelIds: filters.labelIds.filter((labelId) => labelId !== id) })
    });
  }
  if (filters.date.preset !== "any") pills.push({ key: "date", text: dateLabel(filters.date), remove: () => onChange({ date: { preset: "any" } }) });
  if (pills.length === 0) return null;
  return (
    <ul className="ios-pills" aria-label="Filtros aplicados">
      {pills.map((pill) => (
        <li key={pill.key} className="ios-pill" style={pill.color ? { ["--label-color" as string]: pill.color } : undefined}>
          {pill.color ? <span className="ios-label__dot" aria-hidden="true" /> : null}
          {pill.text}
          <button type="button" aria-label={`Quitar filtro ${pill.text}`} onClick={pill.remove}>
            <CloseGlyph />
          </button>
        </li>
      ))}
    </ul>
  );
}
