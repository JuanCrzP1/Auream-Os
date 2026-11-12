import "./deal-card.css";
import "./list-view.css";
import type { BoardFilters, BoardResponse, DealCard as Card, StageSummary } from "@contracts/CrmContracts";
import { formatMoney } from "@shared/format/formatMoney";
import { dueLabel, formatTotals, initialsOf, timeAgo } from "../crmFormat";
import { toneOf } from "./DealCard";
import { MoveMenu } from "./MoveMenu";
import { useStageCards } from "./useStageCards";

/**
 * La lista: se elige una etapa (con su número y lo que suma) y se ven todos
 * sus clientes en una tabla, para buscar y revisar muchos a la vez.
 */
export function ListView({
  pipelineId,
  board,
  stages,
  stageId,
  filters,
  refreshKey,
  canWrite,
  onSelectStage,
  onOpen,
  onMove
}: {
  readonly pipelineId: string;
  readonly board: BoardResponse;
  readonly stages: ReadonlyArray<StageSummary>;
  readonly stageId: string;
  readonly filters: BoardFilters;
  readonly refreshKey: number;
  readonly canWrite: boolean;
  readonly onSelectStage: (stageId: string) => void;
  readonly onOpen: (card: Card) => void;
  readonly onMove: (card: Card, stageId: string) => void;
}) {
  const list = useStageCards(pipelineId, stageId, filters, refreshKey);
  const columnOf = (id: string) => board.columns.find((column) => column.stageId === id);
  const current = stages.find((stage) => stage.id === stageId);

  return (
    <div className="list-view">
      <div className="list-view__stages" role="tablist" aria-label="Etapas">
        {stages.map((stage) => (
          <button key={stage.id} type="button" role="tab" aria-selected={stage.id === stageId} className="list-view__stage" style={{ ["--stage-color" as string]: stage.color }} onClick={() => onSelectStage(stage.id)}>
            <span className="list-view__dot" aria-hidden="true" />
            {stage.name}
            <span className="list-view__count">{columnOf(stage.id)?.count ?? 0}</span>
          </button>
        ))}
      </div>
      <section className="list-view__panel" aria-label={current ? `Clientes en ${current.name}` : "Clientes"}>
        <header className="list-view__summary">
          <strong>{current?.name}</strong>
          <span>{formatTotals(columnOf(stageId)?.totals ?? [], "Sin valor")}</span>
        </header>
        {list.status === "loading" && list.cards.length === 0 ? (
          <div className="list-view__empty" aria-busy="true">Cargando…</div>
        ) : list.cards.length === 0 ? (
          <div className="list-view__empty">Nadie en esta etapa{filters.search || filters.owner ? " con estos filtros" : ""}.</div>
        ) : (
          <div className="list-view__scroll">
            <table className="list-view__table">
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col">Valor</th>
                  <th scope="col">Responsable</th>
                  <th scope="col">Seguimiento</th>
                  <th scope="col"><span className="list-view__sr">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {list.cards.map((card) => {
                  const due = card.nextFollowUp ? dueLabel(card.nextFollowUp.dueAt) : null;
                  return (
                    <tr key={card.dealId ?? card.contactId}>
                      <td>
                        <button type="button" className="list-view__client" onClick={() => onOpen(card)}>
                          <span className={`list-view__avatar deal-card__avatar--${toneOf(card.contactId)}`} aria-hidden="true">{initialsOf(card.name, card.phone)}</span>
                          <span>
                            <span className="list-view__name">{card.name ?? `+${card.phone ?? ""}`}{card.country ? <span className="list-view__country">{card.country}</span> : null}</span>
                            <span className="list-view__meta">
                              {card.number > 1 || !card.current ? `${card.number}.ª compra${card.current ? "" : " (anterior)"} · ` : ""}
                              {card.lastMessageAt ? `Escribió ${timeAgo(card.lastMessageAt)}` : `Aquí ${timeAgo(card.enteredAt)}`}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td>
                        <span className="list-view__value">{card.value ? formatMoney(card.value.amount, card.value.currency) : "Sin valor"}</span>
                        {card.productName ? <span className="list-view__meta">{card.productName}</span> : null}
                      </td>
                      <td className="list-view__owner">{card.ownerName ?? "Sin responsable"}</td>
                      <td>{due ? <span className={`deal-card__due deal-card__due--${due.tone}`}>{due.text}</span> : <span className="list-view__meta">Sin seguimiento</span>}</td>
                      <td className="list-view__actions">{canWrite && card.current ? <MoveMenu stages={stages} currentStageId={card.stageId} label={`Mover a ${card.name ?? "cliente"}`} onMove={(to) => onMove(card, to)} /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {list.hasMore ? (
          <button type="button" className="ui-btn ui-btn--ghost list-view__more" onClick={() => void list.more()}>
            Ver más
          </button>
        ) : null}
      </section>
    </div>
  );
}
