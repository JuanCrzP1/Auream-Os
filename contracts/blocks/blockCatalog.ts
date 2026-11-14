import type { NodeType } from "../FlowSnapshot";
import { START_NODE_NAME } from "../FlowEntry";
import { AI_DEFAULT_CONFIG, readAiConfig } from "../AiConfig";
import { CONDITION_DEFAULT_CONFIG, readConditionConfig } from "../ConditionConfig";
import { DISTRIBUTOR_DEFAULT_CONFIG, readDistributorOutputs } from "../DistributorConfig";
import { INTEGRATION_DEFAULT_CONFIG, readIntegrationConfig } from "../IntegrationConfig";
import { INTERVAL_DEFAULT_CONFIG, readIntervalConfig } from "../IntervalConfig";
import { MENU_DEFAULT_CONFIG, readMenuConfig } from "../MenuConfig";
import { readMessageItems } from "../MessageConfig";
import { NOTIFICATION_DEFAULT_CONFIG, readNotificationConfig } from "../NotificationConfig";
import { PAYMENT_PROOF_DEFAULT_CONFIG, readPaymentProofConfig } from "../PaymentProofConfig";
import { PIXEL_DEFAULT_CONFIG, readPixelConfig } from "../PixelConfig";
import { RECORD_SALE_DEFAULT_CONFIG, readRecordSaleConfig } from "../RecordSaleConfig";
import { TAGS_DEFAULT_CONFIG, readTagsConfig } from "../TagsConfig";
import { WAIT_RESPONSE_DEFAULT_CONFIG, readWaitResponseConfig } from "../WaitResponseConfig";
import type { BlockData, BlockOutput, BlockRules } from "./BlockRules";
import { GO_TO_FLOW_BLOCK, SET_FIELD_BLOCK } from "./dataFlowBlocks";
import { aiOutputs, conditionOutputs, distributorOutputs, integrationOutputs, menuOutputs, paymentProofOutputs, waitResponseOutputs } from "./outputs";
import { validateAi } from "./validation/ai";
import { validateCondition } from "./validation/condition";
import { validateDistributor } from "./validation/distributor";
import { validateIntegration } from "./validation/integration";
import { validateInterval } from "./validation/delay";
import { validateMenu } from "./validation/menu";
import { validateMessageContent } from "./validation/message";
import { validateNotification } from "./validation/notification";
import { validatePaymentProof } from "./validation/paymentProof";
import { validatePixel } from "./validation/pixel";
import { validateRecordSale } from "./validation/recordSale";
import { validateTags } from "./validation/tags";
import { validateWaitResponse } from "./validation/waitResponse";

// ---------------------------------------------------------------------------
// El catálogo de bloques: las reglas de cada tipo, una sola vez. El editor web
// les suma lo visual (`tools/<herramienta>/definition.ts`); el servidor MCP
// las usa para que un agente cree y edite flujos igual que una persona.
// ---------------------------------------------------------------------------

const data = (value: object): BlockData => value as BlockData;
const empty = (): BlockData => ({});

export const START_BLOCK: BlockRules = { type: "start", label: START_NODE_NAME, defaultContent: {}, defaultConfig: {}, availableInPalette: false, terminal: false, normalizeConfig: empty };

export const MESSAGE_BLOCK: BlockRules = {
  type: "message",
  label: "Mensaje",
  // Nace sin `content.text`: su contenido es `config.items`.
  defaultContent: {},
  defaultConfig: { items: [] },
  availableInPalette: true,
  terminal: false,
  validate: validateMessageContent,
  normalizeConfig: (config) => ({ items: readMessageItems(config, {}) })
};

export const WAIT_RESPONSE_BLOCK: BlockRules = {
  type: "question",
  label: "Esperar respuesta",
  defaultContent: {},
  defaultConfig: data(WAIT_RESPONSE_DEFAULT_CONFIG),
  availableInPalette: true,
  terminal: false,
  outputs: waitResponseOutputs,
  validate: validateWaitResponse,
  normalizeConfig: (config) => data(readWaitResponseConfig(config))
};

export const TAGS_BLOCK: BlockRules = { type: "tags", label: "Etiquetas", defaultContent: {}, defaultConfig: data(TAGS_DEFAULT_CONFIG), availableInPalette: true, terminal: false, validate: validateTags, normalizeConfig: (config) => data(readTagsConfig(config)) };

export const PAYMENT_PROOF_BLOCK: BlockRules = {
  type: "payment-proof",
  label: "Comprobante automático",
  defaultContent: {},
  defaultConfig: data(PAYMENT_PROOF_DEFAULT_CONFIG),
  availableInPalette: true,
  terminal: false,
  outputs: paymentProofOutputs,
  validate: validatePaymentProof,
  normalizeConfig: (config) => data(readPaymentProofConfig(config))
};

export const CONDITION_BLOCK: BlockRules = {
  type: "condition",
  label: "Condicional",
  defaultContent: {},
  defaultConfig: data(CONDITION_DEFAULT_CONFIG),
  availableInPalette: true,
  terminal: false,
  outputs: conditionOutputs,
  validate: validateCondition,
  normalizeConfig: (config) => data(readConditionConfig(config))
};

export const DISTRIBUTOR_BLOCK: BlockRules = {
  type: "distributor",
  label: "Distribuidor",
  defaultContent: { text: "Reparto entre salidas" },
  defaultConfig: data(DISTRIBUTOR_DEFAULT_CONFIG),
  availableInPalette: true,
  terminal: false,
  outputs: distributorOutputs,
  validate: validateDistributor,
  normalizeConfig: (config) => ({ outputs: readDistributorOutputs(config) })
};

export const PIXEL_BLOCK: BlockRules = { type: "pixel", label: "Pixel", defaultContent: {}, defaultConfig: data(PIXEL_DEFAULT_CONFIG), availableInPalette: true, terminal: false, validate: validatePixel, normalizeConfig: (config) => data(readPixelConfig(config)) };

export const AI_BLOCK: BlockRules = {
  type: "ai",
  label: "Extensión IA",
  defaultContent: {},
  defaultConfig: data(AI_DEFAULT_CONFIG),
  availableInPalette: true,
  terminal: false,
  outputs: aiOutputs,
  validate: validateAi,
  normalizeConfig: (config) => data(readAiConfig(config))
};

export const DELAY_BLOCK: BlockRules = {
  type: "delay",
  label: "Programador",
  defaultContent: { text: "Continuar más tarde" },
  defaultConfig: data(INTERVAL_DEFAULT_CONFIG),
  availableInPalette: true,
  terminal: false,
  validate: validateInterval,
  normalizeConfig: (config) => data(readIntervalConfig(config))
};

export const INTEGRATION_BLOCK: BlockRules = {
  type: "integration",
  label: "Integración",
  defaultContent: {},
  defaultConfig: data(INTEGRATION_DEFAULT_CONFIG),
  availableInPalette: true,
  terminal: false,
  outputs: integrationOutputs,
  validate: validateIntegration,
  normalizeConfig: (config) => data(readIntegrationConfig(config))
};

export const MENU_BLOCK: BlockRules = {
  type: "menu",
  label: "Menú",
  defaultContent: {},
  defaultConfig: data(MENU_DEFAULT_CONFIG),
  availableInPalette: true,
  terminal: false,
  outputs: menuOutputs,
  validate: validateMenu,
  normalizeConfig: (config) => data(readMenuConfig(config))
};

export const NOTIFICATION_BLOCK: BlockRules = {
  type: "notification",
  label: "Notificación",
  defaultContent: {},
  defaultConfig: data(NOTIFICATION_DEFAULT_CONFIG),
  availableInPalette: true,
  terminal: false,
  validate: validateNotification,
  normalizeConfig: (config) => data(readNotificationConfig(config))
};

/** Registrar venta: guarda la venta en Ventas (va después del Comprobante «válido» o de un pago confirmado). */
export const RECORD_SALE_BLOCK: BlockRules = { type: "record-sale", label: "Registrar venta", defaultContent: {}, defaultConfig: data(RECORD_SALE_DEFAULT_CONFIG), availableInPalette: true, terminal: false, validate: validateRecordSale, normalizeConfig: (config) => data(readRecordSaleConfig(config)) };

/** Finalizar: bloque de SISTEMA que cierra una rama; no se ofrece en la paleta. */
export const END_BLOCK: BlockRules = { type: "end", label: "Finalizar", defaultContent: { text: "Cerrar rama del flujo" }, defaultConfig: {}, availableInPalette: false, terminal: true, normalizeConfig: empty };

/** Todos los bloques, en el orden de la paleta (los de sistema al principio y al final). */
export const BLOCK_CATALOG: ReadonlyArray<BlockRules> = [
  START_BLOCK,
  MESSAGE_BLOCK, WAIT_RESPONSE_BLOCK, TAGS_BLOCK, PAYMENT_PROOF_BLOCK, RECORD_SALE_BLOCK, SET_FIELD_BLOCK,
  CONDITION_BLOCK, DISTRIBUTOR_BLOCK, PIXEL_BLOCK, AI_BLOCK, DELAY_BLOCK, INTEGRATION_BLOCK, MENU_BLOCK, NOTIFICATION_BLOCK, GO_TO_FLOW_BLOCK,
  END_BLOCK
];

export { GO_TO_FLOW_BLOCK, SET_FIELD_BLOCK };

const BY_TYPE = new Map<string, BlockRules>(BLOCK_CATALOG.map((block) => [block.type, block]));

export function findBlockRules(type: string): BlockRules | null {
  return BY_TYPE.get(type) ?? null;
}

/** Las salidas con nombre de un bloque; `null` si tiene una sola salida implícita (o el tipo no existe). */
export function blockOutputs(type: NodeType | string, config: BlockData): ReadonlyArray<BlockOutput> | null {
  const outputs = findBlockRules(type)?.outputs;
  return outputs ? outputs(config) : null;
}
