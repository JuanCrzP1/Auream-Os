import "./flow-review.css";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { flowProblems, type FlowProblem, type FlowReview } from "@features/automations/builder/services/reviewFlow";

interface FlowReviewPanelProps {
  readonly review: FlowReview;
  /** Lleva el lienzo al bloque y lo selecciona. */
  readonly onFocusNode: (nodeId: string) => void;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m2.5 4 1.2 1.2L6 3M2.5 10l1.2 1.2L6 9M8.5 4.2h5M8.5 10.2h5" />
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

function ProblemRow({ problem, onGo }: { readonly problem: FlowProblem; readonly onGo: () => void }) {
  const body = (
    <>
      <span className="flow-review__issue-mark" aria-hidden="true" />
      <span className="flow-review__issue-text">
        {problem.message}
        {problem.count > 1 ? <span className="flow-review__issue-count"> · {problem.count} {problem.nodeIds.length > 0 ? "bloques" : "veces"}</span> : null}
      </span>
    </>
  );

  if (problem.nodeIds.length === 0) return <li className="flow-review__issue">{body}</li>;
  return (
    <li>
      <button type="button" className="flow-review__issue flow-review__issue--link" onClick={onGo}>
        {body}
        <span className="flow-review__issue-go" aria-hidden="true">
          <ChevronIcon />
        </span>
      </button>
    </li>
  );
}

/**
 * «Revisar flujo»: un botón tranquilo en la esquina del lienzo, sin número ni
 * rojo —un flujo a medias no es un flujo malo, y Leona tampoco lo marca—. Al
 * abrirlo dice solo lo que haría fallar el flujo, agrupado, y lleva al bloque;
 * si el mismo problema está en varios, cada toque lleva al siguiente.
 */
export function FlowReviewPanel({ review, onFocusNode }: FlowReviewPanelProps) {
  const [open, setOpen] = useState(false);
  // Por problema, a cuál de sus bloques llevó el último toque.
  const [visits, setVisits] = useState<Record<string, number>>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const problems = useMemo(() => flowProblems(review), [review]);

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

  const goTo = (problem: FlowProblem) => {
    const turn = visits[problem.key] ?? 0;
    setVisits((current) => ({ ...current, [problem.key]: turn + 1 }));
    setOpen(false);
    onFocusNode(problem.nodeIds[turn % problem.nodeIds.length]!);
  };

  return (
    <div ref={rootRef} className="flow-review">
      <button
        type="button"
        className="flow-review__toggle"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flow-review__toggle-icon">
          <ChecklistIcon />
        </span>
        <span className="flow-review__label">Revisar flujo</span>
      </button>

      {open ? (
        <section id={listId} className="flow-review__card" aria-label="Revisar flujo">
          <header className="flow-review__header">
            <h2>Revisar flujo</h2>
            <p>
              {problems.length === 0
                ? "Lo que aún no conectes simplemente termina ahí."
                : "Esto haría fallar el flujo. Toca uno para ir al bloque."}
            </p>
          </header>

          {problems.length === 0 ? (
            <div className="flow-review__empty">
              <span className="flow-review__empty-icon">
                <CheckIcon />
              </span>
              Nada que haga fallar el flujo
            </div>
          ) : (
            <ul className="flow-review__list">
              {problems.map((problem) => (
                <ProblemRow key={problem.key} problem={problem} onGo={() => goTo(problem)} />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
