import "@shared/ui/controls/controls.css";
import "./meta-token.css";
import { useId, useState } from "react";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";

/**
 * Conectar con un token de Meta (de un usuario del sistema del Business
 * Manager, con el permiso ads_read, que no vence): los tres pasos para
 * sacarlo y el paso a paso completo en la ayuda. Se guarda cifrado y nunca
 * se vuelve a mostrar. Mientras Auream no tenga su app de Meta aprobada, es
 * la forma de conectar de todos los clientes.
 */
export function MetaTokenDialog({ onConnect, onClose }: { readonly onConnect: (token: string) => Promise<unknown>; readonly onClose: () => void }) {
  const titleId = useId();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <form
        className="ui-dialog meta-token"
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
        <p className="ui-muted">Un token de un usuario del sistema de tu Business Manager no vence: Auream trae tu gasto sin que tengas que volver a conectar.</p>
        <ol className="meta-token__steps">
          <li>En <strong>Configuración del negocio → Usuarios del sistema</strong>, crea uno (o usa uno que ya tengas).</li>
          <li>Asígnale tu <strong>cuenta publicitaria</strong> con permiso para ver el rendimiento.</li>
          <li><strong>Generar token</strong>: vencimiento <strong>Nunca</strong> y el permiso <strong>ads_read</strong>. Cópialo y pégalo aquí.</li>
        </ol>
        <a className="ui-link meta-token__help" href="/help?article=conectar-meta-ads" target="_blank" rel="noopener noreferrer">
          Ver el paso a paso en la ayuda ↗
        </a>
        <label className="ui-field">
          <span>Token de acceso</span>
          <input className="ui-input" type="password" spellCheck={false} autoComplete="off" value={token} placeholder="EAAB…" onChange={(event) => setToken(event.target.value)} autoFocus />
        </label>
        <p className="meta-token__safe">Se guarda cifrado y no se vuelve a mostrar. Auream solo lo usa para leer tus anuncios.</p>
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={busy || token.trim().length < 20}>{busy ? "Conectando…" : "Conectar"}</button>
        </div>
      </form>
    </div>
  );
}
