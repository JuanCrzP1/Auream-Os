import "@shared/ui/controls/controls.css";
import { useId, useState } from "react";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";

/**
 * Conectar con un token de Meta (de un usuario del sistema del Business
 * Manager, con el permiso ads_read). Se guarda cifrado y nunca se vuelve a
 * mostrar. Para quien no puede usar el inicio de sesión.
 */
export function MetaTokenDialog({ onConnect, onClose }: { readonly onConnect: (token: string) => Promise<unknown>; readonly onClose: () => void }) {
  const titleId = useId();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <form
        className="ui-dialog"
        onClick={(event) => event.stopPropagation()}
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await onConnect(token.trim());
            onClose();
          } catch (e) {
            setError(apiErrorMessage(e, "No se pudo conectar con ese token."));
            setBusy(false);
          }
        }}
      >
        <h2 id={titleId}>Conectar con un token</h2>
        <p className="ui-muted">En Meta Business → Configuración → Usuarios del sistema, genera un token con el permiso <strong>ads_read</strong> y pégalo aquí. Se guarda cifrado.</p>
        <label className="ui-field">
          <span>Token de acceso</span>
          <input className="ui-input" type="password" autoComplete="off" value={token} placeholder="EAAB…" onChange={(event) => setToken(event.target.value)} autoFocus />
        </label>
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={busy || token.trim().length < 20}>{busy ? "Conectando…" : "Conectar"}</button>
        </div>
      </form>
    </div>
  );
}
