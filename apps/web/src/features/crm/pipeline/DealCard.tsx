import "./deal-card.css";
import type { DealCard as Card, StageSummary } from "@contracts/CrmContracts";
import { formatMoney } from "@shared/format/formatMoney";
import { dueLabel, initialsOf, timeAgo } from "../crmFormat";
import { MoveMenu } from "./MoveMenu";

/** Un tono por persona (el mismo siempre), para reconocerla de un vistazo. */
const TONES = ["violet", "teal", "amber", "indigo"] as const;
export const toneOf = (key: string) => TONES[[...key].reduce((sum, char) => sum + char.charCodeAt(0), 0) % TONES.length]!;

/**
 * Un cliente en el tablero: quién es, hace cuánto escribió, cuánto vale, su
 * próximo seguimiento y quién lo atiende. Se arrastra a otra columna o se
 * mueve con «Mover a…» (teclado y celular). Tocarlo abre su ficha.
 */
export function DealCard({
  card,
  stages,
  canWrite,
  dragging,
  onOpen,
  onMove,
  onDragStart,
  onDragEnd
}: {
  readonly card: Card;
  readonly stages: ReadonlyArray<StageSummary>;
  readonly canWrite: boolean;
  readonly dragging?: boolean;
  readonly onOpen: (card: Card) => void;
  readonly onMove: (card: Card, stageId: string) => void;
  readonly onDragStart?: (card: Card) => void;
  readonly onDragEnd?: () => void;
}) {
  const due = card.nextFollowUp ? dueLabel(card.nextFollowUp.dueAt) : null;
  const name = card.name ?? (card.phone ? `+${card.phone}` : "Sin nombre");
  return (
    <article
      className={`deal-card${dragging ? " deal-card--dragging" : ""}`}
      draggable={canWrite}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", card.contactId);
        event.dataTransfer.effectAllowed = "move";
        onDragStart?.(card);
      }}
      onDragEnd={onDragEnd}
    >
      <button type="button" className="deal-card__open" onClick={() => onOpen(card)} aria-label={`Abrir la ficha de ${name}`}>
        <span className="deal-card__who">
          <span className={`deal-card__avatar deal-card__avatar--${toneOf(card.contactId)}`} aria-hidden="true">{initialsOf(card.name, card.phone)}</span>
          <span className="deal-card__identity">
            <span className="deal-card__name">{name}</span>
            <span className="deal-card__meta">
              {card.country ? <span className="deal-card__country">{card.country}</span> : null}
              {card.lastMessageAt ? `Escribió ${timeAgo(card.lastMessageAt)}` : `Aquí ${timeAgo(card.enteredAt)}`}
            </span>
          </span>
        </span>
        <span className="deal-card__value">
          {card.value ? formatMoney(card.value.amount, card.value.currency) : <span className="deal-card__novalue">Sin valor</span>}
          {card.productName ? <span className="deal-card__product">{card.productName}</span> : null}
        </span>
      </button>
      <span className="deal-card__footer">
        {due ? <span className={`deal-card__due deal-card__due--${due.tone}`} title={card.nextFollowUp!.title}>{due.text}</span> : <span className="deal-card__due deal-card__due--none">Sin seguimiento</span>}
        <span className="deal-card__tools">
          {card.ownerId ? (
            <span className={`deal-card__owner deal-card__avatar--${toneOf(card.ownerId)}`} title={card.ownerName ?? ""} aria-label={`Lo atiende ${card.ownerName ?? "alguien del equipo"}`}>
              {initialsOf(card.ownerName)}
            </span>
          ) : (
            <span className="deal-card__owner deal-card__owner--none" title="Sin responsable" aria-label="Sin responsable">?</span>
          )}
          {canWrite ? <MoveMenu stages={stages} currentStageId={card.stageId} onMove={(stageId) => onMove(card, stageId)} label={`Mover a ${name}`} /> : null}
        </span>
      </span>
    </article>
  );
}
