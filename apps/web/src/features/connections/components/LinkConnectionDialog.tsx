import { useCallback, useEffect, useId, useRef, useState } from "react";
import { LINK_POLL_INTERVAL_MS, type ConnectionLinkState, type ConnectionSummary } from "@contracts/ConnectionContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { formatPhone } from "@shared/phone/formatPhone";
import { ChatPhoneGlyph, OfficialGlyph, QrGlyph } from "./ConnectionGlyphs";

// ---------------------------------------------------------------------------
// Vincular un número. Pide la vinculación y muestra lo que toca:
//   · el código QR, que se renueva solo: la ventana consulta cada pocos
//     segundos y en cuanto se escanea pasa a «Número conectado»
//   · el código vencido, con un botón para generar otro
//   · el número ya conectado
//   · sin proveedor configurado: cómo será el proceso, sin fingir un código
// ---------------------------------------------------------------------------

const QR_STEPS = ["Abre WhatsApp en tu celular", "Toca Menú o Configuración → Dispositivos vinculados", "Toca «Vincular un dispositivo» y apunta al código"];
const CLOUD_STEPS = ["Inicia sesión con tu cuenta de Meta Business", "Elige o registra el número de WhatsApp Business", "Autoriza a Auream para enviar y recibir mensajes"];

type View = { readonly kind: "loading" } | { readonly kind: "error"; readonly message: string } | { readonly kind: "ready"; readonly state: ConnectionLinkState };

export function LinkConnectionDialog({
  connection,
  onLink,
  onCheck,
  onClose
}: {
  readonly connection: ConnectionSummary;
  readonly onLink: (id: string) => Promise<ConnectionLinkState>;
  readonly onCheck: (id: string) => Promise<ConnectionLinkState>;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const [view, setView] = useState<View>({ kind: "loading" });
  const failures = useRef(0);

  const request = useCallback(async () => {
    setView({ kind: "loading" });
    try {
      setView({ kind: "ready", state: await onLink(connection.id) });
    } catch (e) {
      setView({ kind: "error", message: apiErrorMessage(e, "No se pudo preparar la vinculación. Inténtalo de nuevo.") });
    }
  }, [connection.id, onLink]);

  useEffect(() => {
    void request();
  }, [request]);

  // Mientras se muestra el QR, se consulta si ya se escaneó (y trae el QR renovado).
  const waiting = view.kind === "ready" && view.state.state === "qr";
  useEffect(() => {
    if (!waiting) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const state = await onCheck(connection.id);
        failures.current = 0;
        if (!cancelled) setView({ kind: "ready", state });
      } catch (e) {
        // Un fallo suelto no interrumpe; varios seguidos, sí.
        if (++failures.current >= 3 && !cancelled) setView({ kind: "error", message: apiErrorMessage(e, "Se perdió la comunicación con el proveedor de WhatsApp.") });
      }
    }, LINK_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [waiting, connection.id, onCheck]);

  const state = view.kind === "ready" ? view.state : null;
  const isQr = connection.method === "qr";
  const steps = isQr ? QR_STEPS : CLOUD_STEPS;

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onClose}>
      <div className="ui-dialog wa-dialog wa-link" onClick={(event) => event.stopPropagation()}>
        <p className="wa-dialog__step">{isQr ? "Vincular con código QR" : "Conectar con la API oficial"}</p>
        <h2 id={titleId}>{connection.name}</h2>

        {view.kind === "loading" ? (
          <div className="wa-link__body" role="status">
            <div className="wa-qr wa-qr--loading" aria-hidden="true">
              <span className="wa-qr__spinner" />
            </div>
            <p className="ui-muted">Preparando la vinculación…</p>
          </div>
        ) : null}

        {view.kind === "error" ? (
          <div className="wa-link__body">
            <p className="ui-error" role="alert">{view.message}</p>
          </div>
        ) : null}

        {state?.state === "qr" ? (
          <div className="wa-link__body wa-link__body--split">
            <div className="wa-qr">
              {state.qrImage ? (
                <img src={state.qrImage} alt="Código QR para vincular el número" />
              ) : (
                <span className="wa-qr__spinner" role="status" aria-label="Generando el código" />
              )}
            </div>
            <div>
              <ol className="wa-steps">
                {steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="wa-waiting" aria-live="polite">
                <span className="wa-waiting__dot" aria-hidden="true" />
                Esperando que escanees el código… se renueva solo.
              </p>
            </div>
          </div>
        ) : null}

        {state?.state === "connected" ? (
          <div className="wa-link__body wa-link__success" role="status">
            <span className="wa-link__success-icon" aria-hidden="true"><ChatPhoneGlyph /></span>
            <p><strong>¡Número conectado!</strong></p>
            {state.connection.phoneNumber ? <p className="ui-muted">{formatPhone(state.connection.phoneNumber).text}</p> : null}
            {state.connection.profileName ? <p className="ui-muted">{state.connection.profileName}</p> : null}
          </div>
        ) : null}

        {state?.state === "disconnected" ? (
          <div className="wa-link__body wa-link__body--split">
            <div className="wa-qr wa-qr--preview" aria-hidden="true"><QrGlyph /></div>
            <div>
              <p className="wa-soon wa-soon--warning">
                <strong>El código venció</strong>
                <span>Pasó el tiempo para escanearlo. Genera otro y escanéalo desde tu celular.</span>
              </p>
              <button type="button" className="ui-btn ui-btn--primary" onClick={() => void request()}>Generar otro código</button>
            </div>
          </div>
        ) : null}

        {state?.state === "unavailable" ? (
          <div className="wa-link__body wa-link__body--split">
            <div className="wa-qr wa-qr--preview" aria-hidden="true">
              {isQr ? <QrGlyph /> : <OfficialGlyph />}
            </div>
            <div>
              <p className="wa-soon">
                <strong>Tu conexión ya está creada</strong>
                <span>{state.message}</span>
              </p>
              <p className="wa-steps__title">Así será la vinculación</p>
              <ol className="wa-steps">
                {steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        ) : null}

        <div className="ui-dialog__footer">
          {view.kind === "error" ? (
            <button type="button" className="ui-btn ui-btn--ghost" onClick={() => void request()}>Reintentar</button>
          ) : null}
          <button type="button" className={`ui-btn ${state?.state === "qr" ? "ui-btn--ghost" : "ui-btn--primary"}`} onClick={onClose}>
            {state?.state === "qr" ? "Cancelar" : state?.state === "connected" ? "Listo" : "Entendido"}
          </button>
        </div>
      </div>
    </div>
  );
}
