import "./board-view.css";
import { useState } from "react";
import type { BoardResponse, DealCard as Card, StageSummary } from "@contracts/CrmContracts";
import { formatTotals } from "../crmFormat";
import { DealCard } from "./DealCard";
import { FunnelRibbon } from "./FunnelRibbon";

/**
 * El tablero: arriba la cinta del embudo alineada con sus columnas, y una
 * columna por etapa (las de «no compró» al final, fuera de la cinta). Se
 * arrastra una tarjeta a otra columna; la columna que la recibe se ilumina.
 */
export function BoardView({
  board,
  stages,
  canWrite,
  onOpen,
  onMove,
  onShowStage
}: {
  readonly board: BoardResponse;
  readonly stages: ReadonlyArray<StageSummary>;
  readonly canWrite: boolean;
  readonly onOpen: (card: Card) => void;
  readonly onMove: (card: Card, stageId: string) => void;
  readonly onShowStage: (stageId: string) => void;
}) {
  const [dragged, setDragged] = useState<Card | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const funnel = stages.filter((stage) => stage.outcome !== "lost");
  const ordered = [...funnel, ...stages.filter((stage) => stage.outcome === "lost")];
  const columnOf = (stageId: string) => board.columns.find((column) => column.stageId === stageId);
  const counts = new Map(board.columns.map((column) => [column.stageId, column.count]));

  const drop = (stageId: string) => {
    if (dragged && dragged.stageId !== stageId) onMove(dragged, stageId);
    setDragged(null);
    setOver(null);
  };

  return (
    <div className="board-view" style={{ ["--board-columns" as string]: ordered.length }}>
      <div className="board-view__grid">
        {/* La cinta va en la primera fila, sobre las columnas de su embudo; las columnas, en la segunda. */}
        <div className="board-view__ribbon" style={{ gridColumn: `1 / span ${funnel.length}`, gridRow: 1 }}>
          <FunnelRibbon stages={funnel} counts={counts} advance={board.metrics.advance} compact />
        </div>
        {ordered.map((stage) => {
          const column = columnOf(stage.id);
          const cards = column?.cards ?? [];
          const count = column?.count ?? 0;
          const receiving = dragged !== null && over === stage.id && dragged.stageId !== stage.id;
          return (
            <section
              key={stage.id}
              aria-label={`${stage.name}: ${count}`}
              className={`board-view__column${receiving ? " board-view__column--over" : ""}${stage.outcome === "lost" ? " board-view__column--lost" : ""}`}
              style={{ ["--stage-color" as string]: stage.color, gridRow: 2 }}
              onDragOver={(event) => {
                if (!dragged) return;
                event.preventDefault();
                setOver(stage.id);
              }}
              onDragLeave={() => setOver((current) => (current === stage.id ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                drop(stage.id);
              }}
            >
              <header className="board-view__header">
                <span className="board-view__title">
                  <span className="board-view__dot" aria-hidden="true" />
                  <h2>{stage.name}</h2>
                  <span className="board-view__count">{count}</span>
                </span>
                <span className="board-view__total">{formatTotals(column?.totals ?? [], count > 0 ? "Sin valor" : "Vacía")}</span>
              </header>
              {receiving ? <div className="board-view__drop">Suelta aquí para pasarlo a {stage.name}</div> : null}
              {cards.map((card) => (
                <DealCard
                  key={card.contactId}
                  card={card}
                  stages={ordered}
                  canWrite={canWrite}
                  dragging={dragged?.contactId === card.contactId}
                  onOpen={onOpen}
                  onMove={onMove}
                  onDragStart={setDragged}
                  onDragEnd={() => {
                    setDragged(null);
                    setOver(null);
                  }}
                />
              ))}
              {count > cards.length ? (
                <button type="button" className="board-view__more" onClick={() => onShowStage(stage.id)}>
                  + {count - cards.length} más · ver en lista
                </button>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
