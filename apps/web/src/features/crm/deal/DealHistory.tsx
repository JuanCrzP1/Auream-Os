import "./deal-history.css";
import type { PipelineSummary } from "@contracts/CrmContracts";
import type { CrmEventSummary } from "@contracts/CrmActivityContracts";
import { timeAgo } from "../crmFormat";

/** Cada cambio en una frase: qué pasó, quién o qué lo hizo y cuándo. */
export function describeEvent(event: CrmEventSummary, pipelines: ReadonlyArray<PipelineSummary>): { readonly title: string; readonly by: string; readonly color: string } {
  const pipeline = pipelines.find((candidate) => candidate.id === event.pipelineId);
  const stage = (id: string | null) => pipeline?.stages.find((candidate) => candidate.id === id);
  const by =
    event.source === "flow" ? `por el flujo «${event.flowName ?? "un flujo"}»`
    : event.source === "sale" ? "por una venta aprobada"
    : event.source === "auto" ? (event.kind === "owner" ? "repartido por turnos" : "al llegar como contacto nuevo")
    : event.actorName ? `lo hizo ${event.actorName}` : "a mano";
  const to = stage(event.toStageId);
  switch (event.kind) {
    case "stage":
      return { title: `Pasó a ${to?.name ?? "una etapa que ya no está"}${event.detail ? ` · ${event.detail}` : ""}`, by, color: to?.color ?? "#94a3b8" };
    case "left":
      return { title: `Salió del embudo «${pipeline?.name ?? "quitado"}»`, by, color: "#94a3b8" };
    case "owner":
      return { title: `${event.detail ?? "Alguien"} quedó como responsable`, by, color: "#6c5ce7" };
    default:
      return { title: `Valor: ${event.detail ?? "sin valor"}`, by, color: "#0d9488" };
  }
}

export function DealHistory({ events, pipelines }: { readonly events: ReadonlyArray<CrmEventSummary>; readonly pipelines: ReadonlyArray<PipelineSummary> }) {
  if (events.length === 0) return <p className="ui-muted deal-history__empty">Aún no hay movimientos.</p>;
  return (
    <ol className="deal-history">
      {events.map((event) => {
        const line = describeEvent(event, pipelines);
        return (
          <li key={event.id} className="deal-history__item">
            <span className="deal-history__dot" style={{ background: line.color }} aria-hidden="true" />
            <span className="deal-history__text">
              <strong>{line.title}</strong>
              <span>{line.by} · {timeAgo(event.createdAt)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
