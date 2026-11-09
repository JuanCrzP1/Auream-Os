import { useId, useState, type ReactNode } from "react";
import { MAX_CONNECTION_NAME, type ConnectionMethod, type ConnectionSummary, type CreateConnectionRequest } from "@contracts/ConnectionContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { OfficialGlyph, QrGlyph } from "./ConnectionGlyphs";

// ---------------------------------------------------------------------------
// Nueva conexión en dos pasos: 1) cómo conectar el número (QR o API oficial,
// con lo bueno y lo que hay que tener en cuenta de cada uno) y 2) su nombre.
// Al crearla, la página abre la vinculación.
// ---------------------------------------------------------------------------

interface MethodOption {
  readonly method: ConnectionMethod;
  readonly title: string;
  /** Llamada a la acción en el estado vacío. */
  readonly cta: string;
  readonly badge: string;
  readonly description: string;
  readonly facts: ReadonlyArray<string>;
  readonly icon: ReactNode;
}

export const METHOD_OPTIONS: ReadonlyArray<MethodOption> = [
  {
    method: "qr",
    title: "Código QR",
    cta: "Conectar por código QR",
    badge: "Listo en un minuto",
    description: "Escaneas un código desde WhatsApp en tu celular, como en WhatsApp Web.",
    facts: ["Usa tu número actual, con su historial", "Sin aprobaciones de Meta", "Ideal para empezar y para volumen moderado"],
    icon: <QrGlyph />
  },
  {
    method: "cloud_api",
    title: "API oficial de Meta",
    cta: "Conectar con la API oficial",
    badge: "Máxima estabilidad",
    description: "La conexión oficial de WhatsApp Business Platform, directa con Meta.",
    facts: ["Sin riesgo de bloqueo por automatizar", "Plantillas aprobadas para escribir primero", "Necesita una cuenta de Meta Business"],
    icon: <OfficialGlyph />
  }
];

const NAME_SUGGESTION: Readonly<Record<ConnectionMethod, string>> = { qr: "Ventas", cloud_api: "Línea oficial" };

export function NewConnectionDialog({
  initialMethod,
  onCreate,
  onCreated,
  onClose
}: {
  readonly initialMethod?: ConnectionMethod;
  readonly onCreate: (request: CreateConnectionRequest) => Promise<ConnectionSummary>;
  readonly onCreated: (connection: ConnectionSummary) => void;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const nameId = useId();
  const [step, setStep] = useState<"method" | "name">(initialMethod ? "name" : "method");
  const [method, setMethod] = useState<ConnectionMethod>(initialMethod ?? "qr");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = METHOD_OPTIONS.find((option) => option.method === method)!;

  const submit = async () => {
    const value = name.trim();
    if (!value) {
      setError("Ponle un nombre para reconocerla, p. ej. «Ventas Colombia».");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onCreated(await onCreate({ name: value, method }));
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo crear la conexión. Inténtalo de nuevo."));
      setBusy(false);
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <div className="ui-dialog wa-dialog" onClick={(event) => event.stopPropagation()}>
        <p className="wa-dialog__step">Paso {step === "method" ? 1 : 2} de 2</p>
        <h2 id={titleId}>{step === "method" ? "¿Cómo quieres conectar el número?" : "Ponle un nombre"}</h2>

        {step === "method" ? (
          <div className="wa-methods" role="radiogroup" aria-label="Forma de conectar">
            {METHOD_OPTIONS.map((option) => (
              <button
                key={option.method}
                type="button"
                role="radio"
                aria-checked={method === option.method}
                className={`wa-method-card wa-method-card--${option.method}${method === option.method ? " is-selected" : ""}`}
                onClick={() => setMethod(option.method)}
              >
                <span className="wa-method-card__head">
                  <span className="wa-method-card__icon" aria-hidden="true">{option.icon}</span>
                  <span className="wa-method-card__badge">{option.badge}</span>
                </span>
                <span className="wa-method-card__title">{option.title}</span>
                <span className="wa-method-card__description">{option.description}</span>
                <span className="wa-method-card__facts">
                  {option.facts.map((fact) => (
                    <span key={fact} className="wa-method-card__fact">{fact}</span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="wa-name-step">
            <p className="wa-chosen">
              <span className="wa-chosen__icon" aria-hidden="true">{chosen.icon}</span>
              <span>
                <strong>{chosen.title}</strong>
                <span className="ui-muted">{chosen.description}</span>
              </span>
            </p>
            <div className="ui-field">
              <label htmlFor={nameId}>Nombre de la conexión</label>
              <input
                id={nameId}
                className="ui-input"
                value={name}
                maxLength={MAX_CONNECTION_NAME}
                placeholder={`P. ej. ${NAME_SUGGESTION[method]} Colombia`}
                autoFocus
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submit();
                }}
              />
              <span className="ui-muted">Solo lo ve tu equipo. Sirve para elegir el número en los flujos.</span>
            </div>
          </div>
        )}

        {error ? <p className="ui-error" role="alert">{error}</p> : null}

        <div className="ui-dialog__footer">
          {step === "method" ? (
            <>
              <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>Cancelar</button>
              <button type="button" className="ui-btn ui-btn--primary" onClick={() => setStep("name")}>Continuar</button>
            </>
          ) : (
            <>
              <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setStep("method")} disabled={busy}>Atrás</button>
              <button type="button" className="ui-btn ui-btn--primary" onClick={() => void submit()} disabled={busy}>
                {busy ? "Creando…" : "Crear conexión"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
