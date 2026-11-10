import "./flow-lab.css";
import "./lab-trace.css";
import { useState } from "react";
import { STATUS_LABEL } from "./labModel";
import { CloseIcon, FlaskIcon, RestartIcon, SendIcon, SlidersIcon } from "./LabIcons";
import { LabChat } from "./LabChat";
import { LabData } from "./LabData";
import { LabSettings } from "./LabSettings";
import { LabTrace } from "./LabTrace";
import type { FlowLab as FlowLabState } from "./useFlowLab";

type Tab = "chat" | "trace" | "data";

/**
 * El laboratorio de pruebas del editor: probar lo que está en el lienzo como
 * si fueras el cliente, con el recorrido bloque a bloque y los datos que van
 * quedando. Flota sobre el lienzo (como la paleta) para ver a la vez los
 * bloques que se iluminan.
 */
export function FlowLab({
  lab,
  blockName,
  onFocusBlock,
  onClose
}: {
  readonly lab: FlowLabState;
  readonly blockName: (nodeId: string) => string;
  readonly onFocusBlock: (nodeId: string) => void;
  readonly onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("chat");
  const [settings, setSettings] = useState(false);
  const [draft, setDraft] = useState("");
  const status = lab.last?.response.status ?? null;
  const steps = lab.turns.reduce((total, turn) => total + turn.response.steps.length, 0);

  const sendText = () => {
    const text = draft.trim();
    if (!text || lab.busy) return;
    setDraft("");
    void lab.send({ type: "message", text });
  };

  return (
    <aside className="flow-lab" aria-label="Laboratorio de pruebas">
      <header className="flow-lab__head">
        <div className="flow-lab__title">
          <span className="flow-lab__badge" aria-hidden="true">
            <FlaskIcon />
          </span>
          <h2>Laboratorio</h2>
          {status ? <span className={`flow-lab__status flow-lab__status--${status}`}>{STATUS_LABEL[status]}</span> : null}
        </div>
        <div className="flow-lab__actions">
          <button type="button" className="flow-lab__icon" aria-label="Ajustes de la prueba" aria-expanded={settings} onClick={() => setSettings((open) => !open)}>
            <SlidersIcon />
          </button>
          <button type="button" className="flow-lab__icon" aria-label="Reiniciar la prueba" onClick={lab.reset} disabled={lab.busy || lab.turns.length === 0}>
            <RestartIcon />
          </button>
          <button type="button" className="flow-lab__icon" aria-label="Cerrar el laboratorio" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
      </header>

      {settings ? <LabSettings options={lab.options} persona={lab.persona} onOptions={lab.setOptions} onPersona={lab.updatePersona} onClose={() => setSettings(false)} /> : null}

      <div className="flow-lab__tabs" role="tablist" aria-label="Vista del laboratorio">
        {([["chat", "Conversación"], ["trace", `Recorrido${steps ? ` · ${steps}` : ""}`], ["data", "Datos"]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className="flow-lab__tab" onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className={`flow-lab__body${tab === "chat" ? " flow-lab__body--chat" : ""}`}>
        {tab === "chat" ? (
          <LabChat
            turns={lab.turns}
            busy={lab.busy}
            blockName={blockName}
            onFocusBlock={onFocusBlock}
            onChoose={(optionId, title) => void lab.send({ type: "choice", optionId, title })}
            onContinue={(auto) => void lab.send({ type: "skip-wait" }, { auto })}
            onStart={() => void lab.send({ type: "start" })}
          />
        ) : null}
        {tab === "trace" ? <LabTrace turns={lab.turns} onFocusBlock={onFocusBlock} /> : null}
        {tab === "data" ? <LabData persona={lab.persona} variables={lab.last?.response.variables ?? {}} /> : null}
      </div>

      {lab.error ? <p className="flow-lab__error" role="alert">{lab.error}</p> : null}

      {tab === "chat" ? (
        <form
          className="flow-lab__composer"
          onSubmit={(event) => {
            event.preventDefault();
            sendText();
          }}
        >
          <input className="ui-input" value={draft} placeholder="Escribe como el cliente…" aria-label="Mensaje del cliente de prueba" maxLength={4000} onChange={(event) => setDraft(event.target.value)} />
          <button type="submit" className="ui-btn ui-btn--primary flow-lab__send" aria-label="Enviar" disabled={lab.busy || !draft.trim()}>
            <SendIcon />
          </button>
        </form>
      ) : null}
    </aside>
  );
}
