import type { BlockData, BlockOutput } from "./BlockRules";
import { AI_OUTPUT, intentKeyOf, readAiConfig } from "../AiConfig";
import { CONDITION_OUTPUT } from "../ConditionConfig";
import { readDistributorOutputs } from "../DistributorConfig";
import { INTEGRATION_OUTPUTS } from "../IntegrationConfig";
import { MENU_OUTPUT, readMenuConfig } from "../MenuConfig";
import { PAYMENT_PROOF_OUTPUT, readPaymentProofConfig } from "../PaymentProofConfig";
import { WAIT_RESPONSE_OUTPUT, hasWaitResponseTimeout, readWaitResponseConfig } from "../WaitResponseConfig";

// ---------------------------------------------------------------------------
// Las salidas con nombre de cada bloque con varios caminos, según su
// configuración. El `id` es lo que guarda la conexión (`fromOutput`) y lo que
// el motor sigue; el `label` es lo que ve el usuario (y el agente).
// ---------------------------------------------------------------------------

/** Extensión IA: una salida por intención + «sin coincidencia», o «Respuesta»; siempre «Error». */
export function aiOutputs(config: BlockData): ReadonlyArray<BlockOutput> {
  const read = readAiConfig(config);
  const failure = { id: AI_OUTPUT.failure, label: "Error" };

  if (read.intents.length === 0) return [{ id: AI_OUTPUT.success, label: "Respuesta" }, failure];

  return [
    ...read.intents.map((intent, index) => ({ id: intent.id, label: intent.key || intentKeyOf(intent, index) })),
    { id: AI_OUTPUT.fallback, label: read.fallbackKey || "Sin coincidencia" },
    failure
  ];
}

export function conditionOutputs(): ReadonlyArray<BlockOutput> {
  return [
    { id: CONDITION_OUTPUT.met, label: "Se cumple" },
    { id: CONDITION_OUTPUT.unmet, label: "No se cumple" }
  ];
}

export function distributorOutputs(config: BlockData): ReadonlyArray<BlockOutput> {
  return readDistributorOutputs(config);
}

export function integrationOutputs(): ReadonlyArray<BlockOutput> {
  return INTEGRATION_OUTPUTS;
}

/** Menú: una salida por opción, «Otra respuesta» y, con tiempo límite, «Tiempo agotado». */
export function menuOutputs(config: BlockData): ReadonlyArray<BlockOutput> {
  const read = readMenuConfig(config);

  return [
    ...read.options.map((option, index) => ({ id: option.id, label: option.title.trim() || `Opción ${index + 1}` })),
    { id: MENU_OUTPUT.other, label: "Otra respuesta" },
    ...(read.timeoutEnabled ? [{ id: MENU_OUTPUT.timeout, label: "Tiempo agotado" }] : [])
  ];
}

/** Comprobante: válido / rechazado, o un motivo de rechazo por salida si se separan. */
export function paymentProofOutputs(config: BlockData): ReadonlyArray<BlockOutput> {
  const read = readPaymentProofConfig(config);
  const O = PAYMENT_PROOF_OUTPUT;

  if (!read.splitRejections) {
    return [
      { id: O.valid, label: "Comprobante válido" },
      { id: O.rejected, label: "Comprobante rechazado" }
    ];
  }

  return [
    { id: O.valid, label: "Comprobante válido" },
    ...(read.matchAccount ? [{ id: O.wrongAccount, label: "Cuenta no registrada" }] : []),
    ...(read.matchHolder ? [{ id: O.wrongHolder, label: "Titular incorrecto" }] : []),
    ...(read.amountCheck !== "off" ? [{ id: O.wrongAmount, label: "Monto incorrecto" }] : []),
    ...(read.maxAgeEnabled ? [{ id: O.tooOld, label: "Comprobante antiguo" }] : []),
    ...(read.rejectDuplicates ? [{ id: O.duplicate, label: "Comprobante repetido" }] : []),
    { id: O.invalid, label: "No es un comprobante" },
    { id: O.failure, label: "Error" }
  ];
}

/** Esperar respuesta: «Respuesta» y, con tiempo máximo, «Tiempo agotado». */
export function waitResponseOutputs(config: BlockData): ReadonlyArray<BlockOutput> {
  return [
    { id: WAIT_RESPONSE_OUTPUT.answer, label: "Respuesta" },
    ...(hasWaitResponseTimeout(readWaitResponseConfig(config)) ? [{ id: WAIT_RESPONSE_OUTPUT.timeout, label: "Tiempo agotado" }] : [])
  ];
}
