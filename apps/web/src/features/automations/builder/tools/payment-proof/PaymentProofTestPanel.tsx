import { useEffect, useId, useState } from "react";
import { BUILT_IN_VARIABLES, variablesIn } from "@contracts/TemplateVariables";
import type { PaymentProofTestResult } from "@contracts/PaymentProofTestContracts";
import type { ToolCapabilities } from "../ToolResources";
import { InlineInput, Notice } from "../_kit/fields";
import { maskNumber, paymentProofOutputs, PAYMENT_PROOF_OUTPUT, type PaymentProofConfig } from "./paymentProofConfig";

// ---------------------------------------------------------------------------
// «Probar»: sube una captura o PDF de un comprobante real y mira qué leyó el
// servidor, cada verificación y por qué salida seguiría el flujo. Es la misma
// lectura del bloque (OCR propio, sin IA). La prueba NO gasta el comprobante.
// ---------------------------------------------------------------------------

const BUILT_IN_NAMES = new Set(BUILT_IN_VARIABLES.map((variable) => variable.name));

const FIELD_LABELS: ReadonlyArray<readonly [string, string]> = [
  ["valor", "Valor"],
  ["fecha", "Fecha"],
  ["banco", "Entidad"],
  ["cuenta_destino", "Cuenta destino"],
  ["titular_destino", "Titular"],
  ["nombre_pagador", "Pagó"],
  ["referencia", "Referencia"]
];

function formatField(name: string, value: string, currency: string): string {
  if (name === "valor") {
    const amount = Number(value);
    try {
      return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: amount % 1 === 0 ? 0 : 2 }).format(amount);
    } catch {
      return `${value} ${currency}`;
    }
  }
  return name === "cuenta_destino" ? maskNumber(value) : value;
}

export function PaymentProofTestPanel({
  config,
  rawConfig,
  test
}: {
  readonly config: PaymentProofConfig;
  /** Configuración tal como está en el editor: es lo que se prueba. */
  readonly rawConfig: Readonly<Record<string, unknown>>;
  readonly test: ToolCapabilities["testPaymentProof"];
}) {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PaymentProofTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!test) return <Notice>La prueba está disponible al editar el flujo con conexión.</Notice>;

  const custom = config.amountCheck === "off" ? [] : variablesIn(config.expectedAmount).filter((name) => !BUILT_IN_NAMES.has(name));
  const outputLabel = (id: string) => paymentProofOutputs(rawConfig).find((output) => output.id === id)?.label ?? id;

  const run = async () => {
    if (!file) return;
    setRunning(true);
    setError(null);
    const outcome = await test(rawConfig, file, Object.fromEntries(custom.map((name) => [name, values[name] ?? ""])));
    setRunning(false);
    if (outcome.ok) setResult(outcome.value);
    else {
      setResult(null);
      setError(outcome.message);
    }
  };

  const valid = result?.output === PAYMENT_PROOF_OUTPUT.valid;
  const fields = result ? FIELD_LABELS.filter(([name]) => result.fields[name]) : [];

  return (
    <div className="pp-test">
      <label className={`pp-test__drop nodrag${file ? " pp-test__drop--filled" : ""}`} htmlFor={inputId}>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="pp-test__file"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setResult(null);
            setError(null);
          }}
        />
        {preview ? <img className="pp-test__thumb" src={preview} alt="" /> : <span className="pp-test__glyph" aria-hidden="true">{file ? "PDF" : "🧾"}</span>}
        <span className="pp-test__drop-text">
          <strong>{file ? file.name : "Elige un comprobante de ejemplo"}</strong>
          <span>{file ? "Toca para cambiarlo" : "Captura o foto (JPG, PNG, WebP) o PDF"}</span>
        </span>
      </label>

      {custom.length > 0 ? (
        <div className="pp-test__values">
          {custom.map((name) => (
            <label key={name} className="pp-test__value">
              <code className="kit-variable">{`{${name}}`}</code>
              <InlineInput
                value={values[name] ?? ""}
                placeholder="Monto de prueba"
                ariaLabel={`Valor de prueba para ${name}`}
                onChange={(value) => setValues((current) => ({ ...current, [name]: value }))}
              />
            </label>
          ))}
        </div>
      ) : null}

      <button type="button" className="pp-test__send nodrag" onClick={() => void run()} disabled={running || !file}>
        {running ? "Leyendo comprobante…" : result || error ? "Revisar de nuevo" : "Revisar comprobante"}
      </button>

      {error ? (
        <p className="pp-test__error" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="pp-test__result" aria-live="polite">
          <p className={`pp-test__status pp-test__status--${valid ? "ok" : "ko"}`}>
            <strong>{outputLabel(result.output)}</strong>
            <span>{result.message}</span>
            <span className="pp-test__muted">
              {result.method === "pdf-text" ? "Texto del PDF" : "Leído con OCR"} · {(result.durationMs / 1000).toFixed(1)} s · la prueba no gasta el comprobante
            </span>
          </p>

          {result.checks.length > 0 ? (
            <ul className="pp-test__checks">
              {result.checks.map((check) => (
                <li key={check.id} className={check.passed ? "is-ok" : "is-ko"}>
                  <span className="pp-test__mark" aria-label={check.passed ? "Cumple" : "No cumple"}>
                    {check.passed ? "✓" : "✕"}
                  </span>
                  {check.detail}
                </li>
              ))}
            </ul>
          ) : null}

          {fields.length > 0 ? (
            <dl className="pp-test__fields">
              {fields.map(([name, label]) => (
                <div key={name}>
                  <dt>{label}</dt>
                  <dd>{formatField(name, result.fields[name]!, result.fields["moneda"] ?? config.amountCurrency)}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {result.missingVariables.length > 0 ? (
            <Notice>Sin valor en la prueba: {result.missingVariables.map((name) => `{${name}}`).join(", ")}. En el flujo se llenan con los datos de la conversación.</Notice>
          ) : null}

          {result.text ? (
            <details className="pp-test__text">
              <summary>Texto leído</summary>
              <pre>{result.text}</pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
