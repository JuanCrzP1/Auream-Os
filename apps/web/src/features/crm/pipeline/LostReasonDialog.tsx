import "@shared/ui/controls/controls.css";
import "./crm-dialogs.css";
import { useId, useState } from "react";

const QUICK = ["Le pareció caro", "No respondió", "Compró en otro lado", "No era lo que buscaba"] as const;

/** Al pasar a alguien a una etapa de «no compró»: por qué (opcional). Queda en su historial. */
export function LostReasonDialog({ stageName, onConfirm, onClose }: { readonly stageName: string; readonly onConfirm: (reason: string) => void; readonly onClose: () => void }) {
  const titleId = useId();
  const [reason, setReason] = useState("");
  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onClose}>
      <form
        className="ui-dialog crm-dialog"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(reason.trim());
        }}
      >
        <h2 id={titleId}>¿Por qué no compró?</h2>
        <p className="ui-muted">Pasa a «{stageName}». El motivo queda en su historial y te ayuda a ver qué mejorar.</p>
        <div className="crm-dialog__chips">
          {QUICK.map((text) => (
            <button key={text} type="button" aria-pressed={reason === text} className="crm-dialog__chip" onClick={() => setReason(text)}>{text}</button>
          ))}
        </div>
        <label className="ui-field">
          <span>Motivo</span>
          <input className="ui-input" value={reason} maxLength={200} placeholder="Escribe otro motivo (opcional)" onChange={(event) => setReason(event.target.value)} />
        </label>
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="ui-btn ui-btn--primary">Mover</button>
        </div>
      </form>
    </div>
  );
}
