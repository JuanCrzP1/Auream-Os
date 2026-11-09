import { useId, useState } from "react";
import {
  MAX_KEYWORD_LENGTH,
  MAX_TRIGGER_KEYWORDS,
  type ConnectionTrigger,
  type ConnectionTriggerType,
  type KeywordMatch,
  type SaveConnectionTriggerRequest
} from "@contracts/ConnectionTriggerContracts";
import type { FlowOption } from "@shared/connections/useConnectionTriggers";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { MATCH_LABEL, TRIGGER_TYPES } from "./triggerInfo";

// ---------------------------------------------------------------------------
// Crear o cambiar un disparador: cuándo (tipo), qué palabras (si aplica) y qué
// flujo arranca. Los tipos genéricos que el número ya tiene no se ofrecen.
// ---------------------------------------------------------------------------

export function TriggerForm({
  initial,
  flows,
  takenTypes,
  onSave,
  onCancel
}: {
  readonly initial?: ConnectionTrigger;
  readonly flows: ReadonlyArray<FlowOption>;
  /** Tipos genéricos que el número ya tiene (uno de cada uno). */
  readonly takenTypes: ReadonlyArray<ConnectionTriggerType>;
  readonly onSave: (request: SaveConnectionTriggerRequest) => Promise<unknown>;
  readonly onCancel: () => void;
}) {
  const keywordId = useId();
  const matchId = useId();
  const flowId = useId();
  const [type, setType] = useState<ConnectionTriggerType>(initial?.type ?? "keyword");
  const [keywords, setKeywords] = useState<string[]>([...(initial?.keywords ?? [])]);
  const [draft, setDraft] = useState("");
  const [match, setMatch] = useState<KeywordMatch>(initial?.match ?? "contains");
  const [automationId, setAutomationId] = useState(initial?.automationId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addKeyword = () => {
    const value = draft.trim().replace(/,$/, "").trim();
    setDraft("");
    if (!value || keywords.some((keyword) => keyword.toLowerCase() === value.toLowerCase()) || keywords.length >= MAX_TRIGGER_KEYWORDS) return;
    setKeywords([...keywords, value.slice(0, MAX_KEYWORD_LENGTH)]);
  };

  const save = async () => {
    const pending = draft.trim();
    const words = pending && !keywords.includes(pending) ? [...keywords, pending] : keywords;
    if (type === "keyword" && words.length === 0) return setError("Escribe al menos una palabra clave y pulsa Enter.");
    if (!automationId) return setError("Elige el flujo que se va a iniciar.");
    setBusy(true);
    setError(null);
    try {
      await onSave({ type, ...(type === "keyword" ? { keywords: words, match } : {}), automationId });
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo guardar el disparador. Inténtalo de nuevo."));
      setBusy(false);
    }
  };

  return (
    <div className="wt-form">
      {!initial ? (
        <div className="wt-types" role="radiogroup" aria-label="Cuándo se inicia el flujo">
          {TRIGGER_TYPES.map((info) => {
            const taken = info.type !== "keyword" && takenTypes.includes(info.type);
            return (
              <button
                key={info.type}
                type="button"
                role="radio"
                aria-checked={type === info.type}
                disabled={taken}
                className={`wt-type${type === info.type ? " is-selected" : ""}`}
                onClick={() => setType(info.type)}
              >
                <span className="wt-type__icon" aria-hidden="true">{info.icon}</span>
                <span className="wt-type__title">{info.title}</span>
                <span className="wt-type__description">{taken ? "Este número ya tiene uno." : info.description}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {type === "keyword" ? (
        <div className="wt-keywords">
          <div className="ui-field">
            <label htmlFor={keywordId}>Palabras clave</label>
            <div className="wt-chips">
              {keywords.map((keyword) => (
                <span key={keyword} className="wt-chip">
                  {keyword}
                  <button type="button" aria-label={`Quitar ${keyword}`} onClick={() => setKeywords(keywords.filter((k) => k !== keyword))}>×</button>
                </span>
              ))}
              <input
                id={keywordId}
                className="wt-chips__input"
                value={draft}
                maxLength={MAX_KEYWORD_LENGTH}
                placeholder={keywords.length === 0 ? "precio, info, menú…" : "Otra palabra…"}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={addKeyword}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addKeyword();
                  } else if (event.key === "Backspace" && draft === "" && keywords.length > 0) {
                    setKeywords(keywords.slice(0, -1));
                  }
                }}
              />
            </div>
            <span className="ui-muted">Pulsa Enter después de cada una. No importan las mayúsculas ni las tildes.</span>
          </div>
          <div className="ui-field">
            <label htmlFor={matchId}>El mensaje…</label>
            <select id={matchId} className="ui-input" value={match} onChange={(event) => setMatch(event.target.value as KeywordMatch)}>
              {(Object.keys(MATCH_LABEL) as KeywordMatch[]).map((value) => (
                <option key={value} value={value}>
                  {MATCH_LABEL[value]} la palabra
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className="ui-field">
        <label htmlFor={flowId}>Flujo que se inicia</label>
        <select id={flowId} className="ui-input" value={automationId} onChange={(event) => setAutomationId(event.target.value)}>
          <option value="" disabled>
            {flows.length === 0 ? "Aún no tienes flujos" : "Elige un flujo…"}
          </option>
          {flows.map((flow) => (
            <option key={flow.id} value={flow.id}>
              {flow.name}
            </option>
          ))}
        </select>
        {flows.length === 0 ? <span className="ui-muted">Crea un flujo en Automatizaciones y vuelve aquí.</span> : null}
      </div>

      {error ? <p className="ui-error" role="alert">{error}</p> : null}

      <div className="ui-dialog__footer">
        <button type="button" className="ui-btn ui-btn--ghost" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button type="button" className="ui-btn ui-btn--primary" onClick={() => void save()} disabled={busy}>
          {busy ? "Guardando…" : initial ? "Guardar cambios" : "Añadir disparador"}
        </button>
      </div>
    </div>
  );
}
