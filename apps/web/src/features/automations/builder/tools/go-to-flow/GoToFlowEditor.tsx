import "./go-to-flow-editor.css";
import { useId, useMemo, useState } from "react";
import { foldAnswer } from "@contracts/FieldValues";
import type { ToolEditorProps } from "../ToolUi";
import type { ToolFlowOption } from "../ToolResources";
import { Notice } from "../_kit/fields";
import { CardSection, ToolEditorLayout } from "../_kit/layout";
import { goToFlowTool } from "./definition";
import { GoToFlowIcon } from "./GoToFlowIcon";
import { readGoToFlowConfig } from "./goToFlowConfig";

const STATUS_LABEL: Readonly<Record<ToolFlowOption["status"], string>> = { active: "Activo", paused: "Pausado", draft: "Borrador", archived: "Archivado" };
/** Con muchos flujos, un buscador. */
const SEARCH_FROM = 7;

/**
 * Editor de «Ir a otro flujo»: el flujo al que pasa el cliente (de la lista
 * de la cuenta, sin este ni los archivados; uno pausado se ve pero no se
 * elige). Abajo, qué pasa al llegar al bloque.
 */
export function GoToFlowEditor({ draft, onChange, resources }: ToolEditorProps) {
  const group = useId();
  const config = readGoToFlowConfig(draft.config);
  const [query, setQuery] = useState("");
  const flows = useMemo(
    () => (resources?.flows ?? []).filter((flow) => flow.status !== "archived" && flow.key !== resources?.currentFlowKey),
    [resources?.flows, resources?.currentFlowKey]
  );
  const shown = useMemo(() => {
    const wanted = foldAnswer(query);
    return wanted ? flows.filter((flow) => foldAnswer(flow.name).includes(wanted)) : flows;
  }, [flows, query]);
  const chosen = (resources?.flows ?? []).find((flow) => flow.id === config.flowId);
  const loading = resources?.flowsStatus === "loading" && flows.length === 0;

  const problem = !config.flowId
    ? null
    : !chosen
      ? loading
        ? null
        : "Ese flujo ya no existe en tu cuenta: elige otro."
      : chosen.key === resources?.currentFlowKey
        ? "Es este mismo flujo: elige otro."
        : chosen.status === "archived"
          ? "Ese flujo está archivado: restáuralo o elige otro."
          : chosen.status === "paused"
            ? "Ese flujo está pausado: mientras siga así, el cliente no pasa."
            : null;

  return (
    <ToolEditorLayout
      accent={goToFlowTool.colors.header}
      outputs={[]}
      Icon={GoToFlowIcon}
      title="Ir a otro flujo"
      description="Este flujo termina aquí y el cliente sigue, en ese mismo momento, en el inicio del flujo que elijas."
      className="go-to-flow"
    >
      <CardSection step={1} title="Flujo" description="El cliente empieza ese flujo desde el inicio.">
        {flows.length >= SEARCH_FROM ? (
          <input className="go-to-flow__search nodrag" type="search" value={query} placeholder="Buscar un flujo…" aria-label="Buscar un flujo" onChange={(event) => setQuery(event.target.value)} />
        ) : null}
        {loading ? (
          <p className="go-to-flow__empty">Cargando tus flujos…</p>
        ) : flows.length === 0 ? (
          <p className="go-to-flow__empty">Aún no tienes otro flujo. Créalo en Automatizaciones y vuelve aquí.</p>
        ) : (
          <div className="go-to-flow__list" role="radiogroup" aria-label="Flujo de destino">
            {shown.map((flow) => {
              const selected = flow.id === config.flowId;
              // Un borrador corre igual (lo guardado es lo que corre); solo uno pausado no recibe clientes.
              const paused = flow.status === "paused";
              return (
                <label key={flow.id} className={`go-to-flow__option${selected ? " is-selected" : ""}${paused ? " is-paused" : ""}`}>
                  <input
                    type="radio"
                    name={group}
                    className="nodrag"
                    checked={selected}
                    disabled={paused && !selected}
                    onChange={() => onChange({ config: { flowId: flow.id, flowName: flow.name } })}
                  />
                  <span className="go-to-flow__name">{flow.name}</span>
                  <span className={`go-to-flow__status go-to-flow__status--${flow.status}`}>{STATUS_LABEL[flow.status]}</span>
                </label>
              );
            })}
            {shown.length === 0 ? <p className="go-to-flow__empty">Ningún flujo se llama así.</p> : null}
          </div>
        )}
        {problem ? <p className="go-to-flow__problem" role="alert">{problem}</p> : null}
      </CardSection>

      <Notice>
        Lo que guardó esta conversación (respuestas, {"{ia.respuesta}"}, lo que trajo una Integración) pasa al otro flujo, que lo puede usar igual. Si ese flujo
        está pausado o archivado cuando llegue el cliente, no pasa y queda anotado.
      </Notice>

      <section className="kit-panel kit-panel--outputs">
        <header className="kit-panel__head">
          <div className="kit-panel__heading">
            <h3 className="kit-panel__title">Caminos de salida</h3>
            <p className="kit-panel__description">Ninguno: la conversación sigue en el otro flujo.</p>
          </div>
        </header>
      </section>
    </ToolEditorLayout>
  );
}
