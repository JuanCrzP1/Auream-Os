import "./flow-review.css";
import { useEffect, useId, useRef, useState } from "react";
import type { FlowIssue, FlowReview } from "@features/automations/builder/services/reviewFlow";

interface FlowReviewPanelProps {
  readonly review: FlowReview;
  /** Lleva el lienzo al bloque del problema y lo selecciona. */
  readonly onFocusNode: (nodeId: string) => void;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2.2 14.3 13H1.7z" />
      <path d="M8 6.4v3.2M8 11.4h.01" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    </svg>
  );
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function summaryLabel({ errorCount, warningCount }: FlowReview): string {
  if (errorCount + warningCount === 0) return "Flujo en orden";
  return plural(errorCount + warningCount, "punto por revisar", "puntos por revisar");
}

function IssueRow({ issue, onFocusNode }: { readonly issue: FlowIssue; readonly onFocusNode: (nodeId: string) => void }) {
  const tone = `flow-review__issue flow-review__issue--${issue.severity}`;
  const body = (
    <>
      <span className="flow-review__issue-mark" aria-hidden="true" />
      <span className="flow-review__issue-text">
        <span className="flow-review__sr">{issue.severity === "error" ? "Error: " : "Aviso: "}</span>
        {issue.message}
      </span>
    </>
  );

  if (!issue.nodeId) return <li className={tone}>{body}</li>;

  const nodeId = issue.nodeId;
  return (
    <li>
      <button type="button" className={`${tone} flow-review__issue--link`} onClick={() => onFocusNode(nodeId)}>
        {body}
        <span className="flow-review__issue-go" aria-hidden="true">
          <ChevronIcon />
        </span>
      </button>
    </li>
  );
}

/**
 * Revisión del flujo: qué está mal o incompleto, siempre a mano en una esquina
 * del lienzo. Solo informa —los flujos se autoguardan, no se publican— y lleva
 * al bloque de cada problema. Las reglas viven en `services/reviewFlow.ts`.
 */
export function FlowReviewPanel({ review, onFocusNode }: FlowReviewPanelProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const total = review.errorCount + review.warningCount;
  const state = review.errorCount > 0 ? "error" : review.warningCount > 0 ? "warning" : "ok";

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="flow-review">
      <button
        type="button"
        className={`flow-review__toggle flow-review__toggle--${state}`}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flow-review__toggle-icon">{state === "ok" ? <CheckIcon /> : <AlertIcon />}</span>
        <span className="flow-review__label">{summaryLabel(review)}</span>
        {review.errorCount > 0 ? (
          <span className="flow-review__count flow-review__count--error" aria-label={plural(review.errorCount, "error", "errores")}>
            {review.errorCount}
          </span>
        ) : null}
        {review.warningCount > 0 ? (
          <span className="flow-review__count flow-review__count--warning" aria-label={plural(review.warningCount, "aviso", "avisos")}>
            {review.warningCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <section id={listId} className="flow-review__card" aria-label="Revisión del flujo">
          <header className="flow-review__header">
            <h2>Revisión del flujo</h2>
            <p>
              {total === 0
                ? "Todo conectado y configurado. Los cambios se guardan solos."
                : "Toca un punto para ir al bloque. Los cambios se guardan solos."}
            </p>
          </header>

          {total === 0 ? (
            <div className="flow-review__empty">
              <span className="flow-review__empty-icon">
                <CheckIcon />
              </span>
              Sin nada por revisar
            </div>
          ) : (
            <ul className="flow-review__list">
              {review.issues.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  onFocusNode={(nodeId) => {
                    setOpen(false);
                    onFocusNode(nodeId);
                  }}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
