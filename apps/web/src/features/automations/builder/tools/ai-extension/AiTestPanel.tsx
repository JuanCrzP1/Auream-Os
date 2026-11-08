import { useState } from "react";
import type { AiTestResult } from "@contracts/AiTestContracts";
import type { ToolCapabilities } from "../ToolResources";
import type { ToolOutput } from "../ToolDefinition";
import { Notice } from "../_kit/fields";

// ---------------------------------------------------------------------------
// «Probar»: el servidor ejecuta el bloque tal como está en el editor (sin
// guardar) con un mensaje de ejemplo, con la conexión real de la cuenta. Se ve
// la respuesta y por qué camino seguiría el flujo. Gasta saldo del proveedor.
// ---------------------------------------------------------------------------

const REASONS: Readonly<Record<string, string>> = {
  not_configured: "Falta elegir conexión y modelo",
  empty_message: "El mensaje llegó vacío",
  credential_not_found: "La conexión ya no existe",
  invalid_key: "Clave rechazada",
  quota_exceeded: "Sin saldo en el proveedor",
  rate_limited: "Límite del proveedor",
  model_not_found: "Modelo no disponible",
  content_filtered: "Contenido bloqueado",
  timeout: "Sin respuesta a tiempo",
  network_error: "Sin conexión con el proveedor",
  provider_error: "Error del proveedor",
  unavailable: "IA no disponible"
};

export function AiTestPanel({
  rawConfig,
  outputs,
  test
}: {
  readonly rawConfig: Readonly<Record<string, unknown>>;
  readonly outputs: ReadonlyArray<ToolOutput>;
  readonly test: ToolCapabilities["testAi"];
}) {
  const [message, setMessage] = useState("Hola, ¿cuánto cuesta el plan pro?");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AiTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!test) return <Notice>La prueba está disponible al editar el flujo con conexión.</Notice>;

  const run = async () => {
    setRunning(true);
    setError(null);
    const outcome = await test({ config: rawConfig, message });
    setRunning(false);
    if (outcome.ok) setResult(outcome.value);
    else {
      setResult(null);
      setError(outcome.message);
    }
  };

  const path = result ? outputs.find((output) => output.id === result.output)?.label ?? result.output : "";

  return (
    <div className="ai-test">
      <label className="kit-field">
        <span className="kit-label">Mensaje del cliente</span>
        <textarea className="kit-textarea nodrag" rows={2} value={message} maxLength={4000} onChange={(event) => setMessage(event.target.value)} />
      </label>
      <button type="button" className="ai-test__send nodrag" onClick={() => void run()} disabled={running || message.trim() === ""}>
        {running ? "Pensando…" : result || error ? "Probar de nuevo" : "Probar"}
      </button>
      <p className="kit-hint">Usa tu conexión real: consume saldo de tu proveedor.</p>

      {error ? (
        <p className="ai-connect__error" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="ai-test__result" aria-live="polite">
          {result.succeeded ? (
            <>
              {result.reply ? <p className="ai-test__bubble">{result.reply}</p> : <p className="kit-hint">La IA no devolvió texto para el cliente.</p>}
              <p className="ai-test__meta">
                <span className="ai-test__path">Seguiría por «{path}»</span>
                <span>{result.durationMs} ms</span>
                {result.usage ? <span>{result.usage.inputTokens + result.usage.outputTokens} tokens</span> : null}
              </p>
              {result.unparsed ? <Notice>El modelo no respondió en el formato de clasificación; el flujo seguiría por el respaldo.</Notice> : null}
            </>
          ) : (
            <p className="ai-test__failure" role="alert">
              <strong>{REASONS[result.reason ?? ""] ?? "Error"}</strong>
              <span>{result.message}</span>
              <span className="ai-test__muted">El flujo seguiría por «Error».</span>
            </p>
          )}
          {result.missingVariables.length > 0 ? (
            <Notice>Sin valor en la prueba: {result.missingVariables.map((name) => `{${name}}`).join(", ")}. En el flujo se llenan con los datos del contacto.</Notice>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
