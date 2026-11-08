import "./integration-test.css";
import { useState } from "react";
import { BUILT_IN_VARIABLES, variablesIn } from "@contracts/TemplateVariables";
import type { IntegrationTestResult } from "@contracts/IntegrationTestContracts";
import type { ToolCapabilities } from "../ToolResources";
import { InlineInput, Notice } from "../_kit/fields";
import { methodHasBody, type IntegrationConfig } from "./integrationConfig";

// ---------------------------------------------------------------------------
// «Probar»: envía la petición tal como está en el editor (sin guardar) con
// datos de ejemplo, muestra qué respondió el servicio y deja guardar cualquier
// dato de la respuesta con un clic. La petición la hace el servidor, con las
// mismas reglas que el bloque en un flujo.
// ---------------------------------------------------------------------------

const BUILT_IN_NAMES = new Set(BUILT_IN_VARIABLES.map((variable) => variable.name));

const REASON_LABELS: Readonly<Record<string, string>> = {
  http_error: "El servicio respondió con un error",
  blocked_destination: "Dirección no permitida",
  timeout: "Sin respuesta a tiempo",
  network_error: "No se pudo conectar",
  response_too_large: "Respuesta demasiado grande",
  too_many_redirects: "Demasiadas redirecciones",
  invalid_url: "URL no válida",
  invalid_header: "Cabecera no válida",
  body_too_large: "Cuerpo demasiado grande",
  unavailable: "Pruebas no disponibles"
};

/** Variables propias (no del sistema) que usa la petición. */
function customVariables(config: IntegrationConfig): string[] {
  const texts = [config.url, ...config.headers.map((header) => header.value), methodHasBody(config.method) ? config.body : ""];
  return [...new Set(texts.flatMap(variablesIn))].filter((name) => !BUILT_IN_NAMES.has(name));
}

function prettyBody(result: IntegrationTestResult): string {
  const body = result.bodyPreview ?? "";
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

export function IntegrationTestPanel({
  config,
  rawConfig,
  test,
  onSavePath
}: {
  readonly config: IntegrationConfig;
  /** Configuración tal como está en el editor: es lo que se prueba. */
  readonly rawConfig: Readonly<Record<string, unknown>>;
  readonly test: ToolCapabilities["testIntegration"];
  readonly onSavePath: (path: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<IntegrationTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const custom = customVariables(config);
  const saved = new Map(config.responseMappings.map((mapping) => [mapping.path.trim(), mapping.field]));

  if (!test) {
    return <Notice>La prueba está disponible al editar el flujo con conexión.</Notice>;
  }

  const run = async () => {
    setRunning(true);
    setError(null);
    const outcome = await test({ config: rawConfig, variables: Object.fromEntries(custom.map((name) => [name, values[name] ?? ""])) });
    setRunning(false);
    if (outcome.ok) setResult(outcome.result);
    else {
      setResult(null);
      setError(outcome.message);
    }
  };

  return (
    <div className="integration-test">
      <p className="kit-hint">
        Se envía de verdad, con datos de ejemplo: {BUILT_IN_VARIABLES.slice(1, 3).map((variable) => variable.sample).join(", ")}…
      </p>

      {custom.length > 0 ? (
        <div className="integration-test__values">
          {custom.map((name) => (
            <label key={name} className="integration-test__value">
              <code className="kit-variable">{`{${name}}`}</code>
              <InlineInput
                value={values[name] ?? ""}
                placeholder="Valor de prueba"
                ariaLabel={`Valor de prueba para ${name}`}
                onChange={(value) => setValues((current) => ({ ...current, [name]: value }))}
              />
            </label>
          ))}
        </div>
      ) : null}

      <button type="button" className="integration-test__send nodrag" onClick={() => void run()} disabled={running || config.url.length === 0}>
        {running ? "Enviando…" : result || error ? "Probar de nuevo" : "Enviar prueba"}
      </button>

      {error ? (
        <p className="integration-test__error" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="integration-test__result" aria-live="polite">
          <p className={`integration-test__status integration-test__status--${result.succeeded ? "ok" : "ko"}`}>
            <strong>{result.status !== undefined ? `${result.status}` : REASON_LABELS[result.reason ?? ""] ?? "Error"}</strong>
            <span>{result.succeeded ? "Éxito: el flujo seguirá por «Éxito»" : `${result.message ?? REASON_LABELS[result.reason ?? ""] ?? ""} · el flujo seguirá por «Error»`}</span>
            <span className="integration-test__time">{result.durationMs} ms</span>
          </p>

          {result.missingVariables.length > 0 ? (
            <Notice>Sin valor en la prueba: {result.missingVariables.map((name) => `{${name}}`).join(", ")}. En el flujo se llenan con los datos del contacto.</Notice>
          ) : null}
          {result.missingPaths.length > 0 ? <Notice>No aparecen en esta respuesta: {result.missingPaths.join(", ")}.</Notice> : null}

          {result.paths.length > 0 ? (
            <div className="integration-test__paths">
              <p className="kit-label">Datos de la respuesta</p>
              <ul>
                {result.paths.map((item) => {
                  const field = saved.get(item.path);
                  return (
                    <li key={item.path}>
                      <code className="integration-test__path">{item.path}</code>
                      <span className="integration-test__preview" title={item.preview}>
                        {item.preview}
                      </span>
                      {field ? (
                        <span className="integration-test__saved">→ {field}</span>
                      ) : (
                        <button type="button" className="integration-test__save nodrag" onClick={() => onSavePath(item.path)} aria-label={`Guardar ${item.path}`}>
                          Guardar
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {result.bodyPreview !== undefined && result.bodyPreview.length > 0 ? (
            <details className="integration-test__body">
              <summary>Ver respuesta completa{result.contentType ? ` (${result.contentType.split(";")[0]})` : ""}</summary>
              <pre>{prettyBody(result)}</pre>
              {result.bodyTruncated ? <p className="kit-hint">Respuesta recortada.</p> : null}
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
