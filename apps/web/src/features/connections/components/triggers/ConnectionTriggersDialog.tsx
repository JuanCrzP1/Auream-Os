import "./triggers.css";
import { useId, useState } from "react";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import type { ConnectionTrigger } from "@contracts/ConnectionTriggerContracts";
import { useConnectionTriggers } from "@shared/connections/useConnectionTriggers";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { TriggerForm } from "./TriggerForm";
import { describeTrigger, TRIGGER_TYPES, typeInfo } from "./triggerInfo";

// ---------------------------------------------------------------------------
// Disparadores de un número: qué flujo se inicia cuando un cliente escribe.
// Se listan en el orden en que se evalúan (gana el más específico); cada uno
// se puede pausar, cambiar o quitar sin salir de la ventana.
// ---------------------------------------------------------------------------

type Mode = { readonly kind: "list" } | { readonly kind: "new" } | { readonly kind: "edit"; readonly trigger: ConnectionTrigger };

const ORDER = TRIGGER_TYPES.map((info) => info.type);

export function ConnectionTriggersDialog({
  connection,
  onClose
}: {
  readonly connection: ConnectionSummary;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const data = useConnectionTriggers(connection.id);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [error, setError] = useState<string | null>(null);
  const sorted = [...data.triggers].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type) || a.createdAt.localeCompare(b.createdAt));
  const takenTypes = data.triggers.map((trigger) => trigger.type);

  const act = async (run: () => Promise<unknown>) => {
    setError(null);
    try {
      await run();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo completar. Inténtalo de nuevo."));
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onClose}>
      <div className="ui-dialog wa-dialog wt-dialog" onClick={(event) => event.stopPropagation()}>
        <p className="wa-dialog__step">{connection.name}</p>
        <h2 id={titleId}>{mode.kind === "new" ? "Nuevo disparador" : mode.kind === "edit" ? "Editar disparador" : "Disparadores"}</h2>

        {mode.kind === "list" ? (
          <>
            <p className="wt-intro">
              Cuando un cliente escribe a este número, se inicia el flujo del primer disparador que coincida. Gana el más específico:{" "}
              <strong>palabra clave → anuncio → primer mensaje → cualquier mensaje</strong>. Si el cliente ya está dentro de un flujo, lo termina primero.
            </p>

            {data.status === "loading" ? <p className="ui-muted" role="status">Cargando disparadores…</p> : null}
            {data.status === "error" ? (
              <p className="ui-error" role="alert">
                No se pudieron cargar los disparadores. <button type="button" className="ui-link" onClick={() => void data.refresh()}>Reintentar</button>
              </p>
            ) : null}

            {data.status === "ready" && sorted.length === 0 ? (
              <div className="wt-empty">
                <strong>Este número todavía no inicia ningún flujo</strong>
                <span>Añade al menos «Cualquier mensaje» para que siempre responda, y palabras clave para casos concretos.</span>
              </div>
            ) : null}

            {sorted.length > 0 ? (
              <ol className="wt-list">
                {sorted.map((trigger) => {
                  const info = typeInfo(trigger.type);
                  return (
                    <li key={trigger.id} className={`wt-row${trigger.enabled ? "" : " is-paused"}`}>
                      <span className="wt-row__icon" aria-hidden="true">{info.icon}</span>
                      <div className="wt-row__body">
                        <span className="wt-row__title">{info.title}</span>
                        <span className="wt-row__description">{describeTrigger(trigger)}</span>
                        <span className="wt-row__flow">
                          <span aria-hidden="true">→</span> Inicia <strong>{trigger.automationName}</strong>
                        </span>
                      </div>
                      <div className="wt-row__actions">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={trigger.enabled}
                          aria-label={`${trigger.enabled ? "Pausar" : "Activar"} ${info.title.toLowerCase()} → ${trigger.automationName}`}
                          className="wt-switch"
                          onClick={() => void act(() => data.update(trigger.id, { enabled: !trigger.enabled }))}
                        >
                          <span />
                        </button>
                        <button type="button" className="ui-btn ui-btn--ghost wt-small" onClick={() => setMode({ kind: "edit", trigger })}>Editar</button>
                        <button
                          type="button"
                          className="ui-btn ui-btn--ghost wt-small wt-danger"
                          aria-label={`Quitar ${info.title.toLowerCase()} → ${trigger.automationName}`}
                          onClick={() => void act(() => data.remove(trigger.id))}
                        >
                          Quitar
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : null}

            {error ? <p className="ui-error" role="alert">{error}</p> : null}

            <div className="ui-dialog__footer">
              <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>Cerrar</button>
              <button type="button" className="ui-btn ui-btn--primary" disabled={data.status !== "ready"} onClick={() => setMode({ kind: "new" })}>
                Añadir disparador
              </button>
            </div>
          </>
        ) : (
          <TriggerForm
            initial={mode.kind === "edit" ? mode.trigger : undefined}
            flows={data.flows}
            takenTypes={takenTypes}
            onCancel={() => setMode({ kind: "list" })}
            onSave={async (request) => {
              if (mode.kind === "edit") await data.update(mode.trigger.id, request);
              else await data.create(request);
              setMode({ kind: "list" });
            }}
          />
        )}
      </div>
    </div>
  );
}
