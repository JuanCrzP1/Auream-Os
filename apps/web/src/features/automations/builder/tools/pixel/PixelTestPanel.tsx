import { useId, useState } from "react";
import type { PixelTestResult } from "@contracts/PixelTestContracts";
import type { ToolCapabilities } from "../ToolResources";
import { Notice } from "../_kit/fields";

// ---------------------------------------------------------------------------
// «Probar»: envía el evento a Meta con el código de «Probar eventos». Así se
// ve en el Administrador de eventos y NO cuenta como conversión real.
// ---------------------------------------------------------------------------

const REASONS: Readonly<Record<string, string>> = {
  not_configured: "Falta elegir el píxel",
  invalid_value: "El valor de la compra no es válido",
  invalid_page: "El ID de la página no es válido",
  connection_not_found: "El píxel ya no existe",
  invalid_token: "Token rechazado",
  pixel_not_found: "El token no tiene acceso a ese píxel",
  invalid_event: "Meta rechazó el evento",
  rate_limited: "Límite de Meta",
  timeout: "Meta no respondió a tiempo",
  network_error: "Sin conexión con Meta",
  provider_error: "Error de Meta",
  unavailable: "Envío no disponible"
};

const SOURCE: Readonly<Record<string, string>> = {
  chat: "conversación",
  business_messaging: "anuncio de clic a WhatsApp"
};

export function PixelTestPanel({ rawConfig, test }: { readonly rawConfig: Readonly<Record<string, unknown>>; readonly test: ToolCapabilities["testPixel"] }) {
  const codeId = useId();
  const [code, setCode] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PixelTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!test) return <Notice>La prueba está disponible al editar el flujo con conexión.</Notice>;

  const run = async () => {
    setRunning(true);
    setError(null);
    const outcome = await test({ config: rawConfig, testEventCode: code.trim() });
    setRunning(false);
    if (outcome.ok) setResult(outcome.value);
    else {
      setResult(null);
      setError(outcome.message);
    }
  };

  return (
    <div className="pixel-test">
      <div className="kit-field">
        <label className="kit-label" htmlFor={codeId}>
          Código de prueba de Meta
        </label>
        <input id={codeId} aria-describedby={`${codeId}-hint`} className="kit-input kit-input--mono nodrag" value={code} placeholder="TEST12345" onChange={(event) => setCode(event.target.value)} />
        <p id={`${codeId}-hint`} className="kit-hint">
          Administrador de eventos → tu píxel → Probar eventos → copia el código. Lo que envíes con él no cuenta en tus campañas.
        </p>
      </div>
      <button type="button" className="pixel-test__send nodrag" onClick={() => void run()} disabled={running || !/^TEST\w+$/i.test(code.trim())}>
        {running ? "Enviando…" : result || error ? "Enviar de nuevo" : "Enviar evento de prueba"}
      </button>

      {error ? (
        <p className="pixel-test__error" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        result.succeeded ? (
          <p className="pixel-test__ok" aria-live="polite">
            <strong>Meta recibió el evento</strong>
            <span>
              {result.eventName} · {SOURCE[result.actionSource ?? ""] ?? result.actionSource}
              {result.value !== undefined ? ` · ${result.value.toLocaleString("es")} ${result.currency}` : ""} · {result.durationMs} ms
            </span>
            <span className="pixel-test__muted">Míralo en «Probar eventos» del Administrador de eventos.</span>
          </p>
        ) : (
          <p className="pixel-test__ko" role="alert">
            <strong>{REASONS[result.reason ?? ""] ?? "Error"}</strong>
            <span>{result.message}</span>
            <span className="pixel-test__muted">En un flujo, la conversación seguiría igual.</span>
          </p>
        )
      ) : null}
    </div>
  );
}
