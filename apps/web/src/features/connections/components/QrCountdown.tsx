import { useEffect, useRef, useState } from "react";
import { WHATSAPP_QR_TIMING } from "@contracts/ConnectionContracts";

// ---------------------------------------------------------------------------
// Cuenta atrás del QR de WhatsApp: cuánto le queda al código que se ve (el
// primero ~60 s, los siguientes ~20 s) y cuánto queda en total para
// escanearlo. Se reinicia sola cada vez que llega un código distinto.
// Es orientativa: lo que vale es el estado que devuelve el servidor.
// ---------------------------------------------------------------------------

interface Clock {
  readonly sessionStartedAt: number;
  readonly codeStartedAt: number;
  readonly codeIndex: number;
  readonly code: string;
}

/** Sigue los códigos que van llegando y el reloj de cada uno. */
export function useQrClock(code: string, sessionKey: number) {
  const [now, setNow] = useState(() => Date.now());
  const clock = useRef<Clock | null>(null);
  const session = useRef(sessionKey);

  if (session.current !== sessionKey) {
    session.current = sessionKey;
    clock.current = null;
  }
  if (code && (!clock.current || clock.current.code !== code)) {
    const at = Date.now();
    clock.current = clock.current
      ? { ...clock.current, code, codeStartedAt: at, codeIndex: clock.current.codeIndex + 1 }
      : { code, codeStartedAt: at, sessionStartedAt: at, codeIndex: 0 };
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const current = clock.current;
  if (!current) return null;
  const codeSeconds = current.codeIndex === 0 ? WHATSAPP_QR_TIMING.firstCodeSeconds : WHATSAPP_QR_TIMING.nextCodeSeconds;
  const codeLeft = Math.max(0, codeSeconds - Math.floor((now - current.codeStartedAt) / 1000));
  const sessionLeft = Math.max(0, WHATSAPP_QR_TIMING.sessionSeconds - Math.floor((now - current.sessionStartedAt) / 1000));
  return { codeLeft, codeSeconds, sessionLeft };
}

const minutes = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export function QrCountdown({ codeLeft, codeSeconds, sessionLeft }: { readonly codeLeft: number; readonly codeSeconds: number; readonly sessionLeft: number }) {
  const percent = Math.round((codeLeft / codeSeconds) * 100);
  return (
    <div className="wa-countdown">
      <div className="wa-countdown__bar" role="progressbar" aria-label="Vigencia del código" aria-valuemin={0} aria-valuemax={codeSeconds} aria-valuenow={codeLeft}>
        <span style={{ width: `${percent}%` }} className={codeLeft <= 5 ? "is-ending" : undefined} />
      </div>
      <p className="wa-countdown__code">{codeLeft > 0 ? `Este código cambia en ${codeLeft} s` : "Cambiando el código…"}</p>
      <p className="wa-countdown__total">
        {sessionLeft > 0 ? (
          <>
            Te quedan <strong>{minutes(sessionLeft)}</strong> para escanear
          </>
        ) : (
          "El tiempo para escanear está por terminar"
        )}
      </p>
    </div>
  );
}
