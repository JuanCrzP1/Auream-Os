import { findTool } from "../tools/registry";
import { resolveToolUi } from "../tools/ui-registry";
import { turnTitle, type LabTurn } from "./labModel";

const STEP_STATUS: Readonly<Record<string, string>> = {
  waiting_input: "Espera respuesta",
  delayed: "En espera",
  completed: "Fin",
  failed: "Error"
};

/**
 * El recorrido de la prueba: por cada turno, los bloques por los que pasó en
 * orden, por qué salida siguió cada uno y lo que hizo («Guardó {nombre}»,
 * «Etiquetas añadidas», «Integración simulada»…). Un toque lleva al bloque.
 */
export function LabTrace({ turns, onFocusBlock }: { readonly turns: ReadonlyArray<LabTurn>; readonly onFocusBlock: (nodeId: string) => void }) {
  if (turns.length === 0) {
    return <p className="lab-trace__empty">Aquí verás, bloque a bloque, el camino que sigue el flujo en cada turno de la prueba.</p>;
  }
  return (
    <ol className="lab-trace">
      {turns.map((turn, index) => (
        <li key={turn.id} className="lab-trace__turn">
          <p className="lab-trace__title">
            <span className="lab-trace__number">{index + 1}</span>
            {turnTitle(turn)}
          </p>
          {turn.response.steps.length === 0 ? <p className="lab-trace__none">No avanzó ningún bloque.</p> : null}
          <ol className="lab-trace__steps">
            {turn.response.steps.map((step, stepIndex) => {
              const { Icon } = resolveToolUi(step.nodeType);
              const color = findTool(step.nodeType)?.colors.header ?? "var(--muted)";
              const status = STEP_STATUS[step.status];
              return (
                <li key={`${step.nodeId}-${stepIndex}`} className={`lab-step lab-step--${step.status}`} style={{ ["--step-color" as string]: color }}>
                  <button type="button" className="lab-step__head" onClick={() => onFocusBlock(step.nodeId)} title="Ver el bloque en el lienzo">
                    <span className="lab-step__icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <span className="lab-step__name">{step.nodeName}</span>
                    {status ? <span className="lab-step__status">{status}</span> : null}
                  </button>
                  {step.output ? <p className="lab-step__output">Salió por «{step.output.label}»</p> : null}
                  {step.notes.length ? (
                    <ul className="lab-step__notes">
                      {step.notes.map((note, noteIndex) => (
                        <li key={noteIndex}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );
}
