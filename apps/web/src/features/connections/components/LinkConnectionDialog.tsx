import { useCallback, useEffect, useId, useState } from "react";
import type { ConnectionLinkState, ConnectionSummary } from "@contracts/ConnectionContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { formatPhone } from "@shared/phone/formatPhone";
import { ChatPhoneGlyph, OfficialGlyph, QrGlyph } from "./ConnectionGlyphs";

// ---------------------------------------------------------------------------
// Vincular un número. Pide al servidor la vinculación y muestra lo que toca:
// el código QR con su cuenta atrás, el número ya conectado, o —mientras no
// haya proveedor configurado— cómo será el proceso, sin fingir un código.
// ---------------------------------------------------------------------------

const QR_STEPS = ["Abre WhatsApp en tu celular", "Toca Menú o Configuración → Dispositivos vinculados", "Toca «Vincular un dispositivo» y apunta al código"];
const CLOUD_STEPS = ["Inicia sesión con tu cuenta de Meta Business", "Elige o registra el número de WhatsApp Business", "Autoriza a Auream para enviar y recibir mensajes"];

type View = { readonly kind: "loading" } | { readonly kind: "error"; readonly message: string } | { readonly kind: "ready"; readonly state: ConnectionLinkState };

function useSecondsLeft(expiresAt: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  return expiresAt ? Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 1000)) : 0;
}

export function LinkConnectionDialog({
  connection,
  onLink,
  onClose
}: {
  readonly connection: ConnectionSummary;
  readonly onLink: (id: string) => Promise<ConnectionLinkState>;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const [view, setView] = useState<View>({ kind: "loading" });

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

  const state = view.kind === "ready" ? view.state : null;
  const secondsLeft = useSecondsLeft(state?.state === "qr" ? state.expiresAt : null);
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
            <div className={`wa-qr${secondsLeft === 0 ? " wa-qr--expired" : ""}`}>
              <img src={state.qrImage} alt="Código QR para vincular el número" />
              {secondsLeft === 0 ? (
                <button type="button" className="ui-btn ui-btn--primary wa-qr__refresh" onClick={() => void request()}>
                  Generar otro código
                </button>
              ) : null}
            </div>
            <div>
              <ol className="wa-steps">
                {steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="wa-countdown" aria-live="polite">
                {secondsLeft > 0 ? `El código caduca en ${secondsLeft} s` : "El código caducó"}
              </p>
            </div>
          </div>
        ) : null}

        {state?.state === "connected" ? (
          <div className="wa-link__body wa-link__success" role="status">
            <span className="wa-link__success-icon" aria-hidden="true"><ChatPhoneGlyph /></span>
            <p><strong>Número conectado</strong></p>
            {state.connection.phoneNumber ? <p className="ui-muted">{formatPhone(state.connection.phoneNumber).text}</p> : null}
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
          <button type="button" className="ui-btn ui-btn--primary" onClick={onClose}>
            {state?.state === "qr" ? "Cerrar" : "Entendido"}
          </button>
        </div>
      </div>
    </div>
  );
}
