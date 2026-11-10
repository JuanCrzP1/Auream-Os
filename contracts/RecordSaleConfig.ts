import { readEnum, readString } from "./ConfigReaders";

// ---------------------------------------------------------------------------
// Registrar venta — contrato de configuración compartido por el builder
// (editor), el motor (RecordSaleNodeHandler) y el servidor MCP.
//
// Separa responsabilidades con el Comprobante: el Comprobante VERIFICA el pago;
// este bloque GUARDA la venta en Ventas (qué producto, cuánto, en qué moneda y
// a quién). Va después de la salida «válido», de una Integración de pago o de
// la confirmación de un asesor. Nunca inventa un precio: si falta el producto,
// el monto o la moneda, la venta queda «Por revisar» y no suma en los totales.
// ---------------------------------------------------------------------------

/**
 *   variable  el monto y la moneda salen de variables (lo leído del comprobante)
 *   product   el precio del producto en el país del cliente (por su teléfono)
 */
export const RECORD_SALE_AMOUNT_MODES = ["variable", "product"] as const;
export type RecordSaleAmountMode = (typeof RECORD_SALE_AMOUNT_MODES)[number];

export interface RecordSaleConfig {
  /** Producto del catálogo (Ventas → Productos). Vacío = sin configurar. */
  readonly productId: string;
  /** Su nombre al elegirlo, SOLO para mostrarlo en el lienzo. El motor usa el id (y el nombre vigente del catálogo). */
  readonly productName: string;
  readonly amountMode: RecordSaleAmountMode;
  /** Monto; admite variables. Solo con `variable`. */
  readonly amount: string;
  /** Moneda ISO 4217 o una variable. Solo con `variable`. */
  readonly currency: string;
  /** Nombre del cliente; admite variables. Vacío o sin valor: el del contacto. */
  readonly customerName: string;
  /**
   * Referencia del pago; admite variables. Si el flujo vuelve a pasar con la
   * misma referencia, la venta no se guarda dos veces.
   */
  readonly reference: string;
  /** Prefijo de las variables que deja: `{venta.valor}`, `{venta.estado}`… */
  readonly resultVariable: string;
}

export const RECORD_SALE_DEFAULT_CONFIG: RecordSaleConfig = {
  productId: "",
  productName: "",
  amountMode: "variable",
  amount: "{comprobante.valor}",
  currency: "{comprobante.moneda}",
  customerName: "{comprobante.nombre_pagador}",
  reference: "{comprobante.referencia}",
  resultVariable: "venta"
};

const VARIABLE_NAME = /^[a-z][a-z0-9_]{0,39}$/;

export function readRecordSaleConfig(config: Readonly<Record<string, unknown>>): RecordSaleConfig {
  const d = RECORD_SALE_DEFAULT_CONFIG;
  const prefix = readString(config["resultVariable"], d.resultVariable).trim();
  const text = (key: keyof RecordSaleConfig, fallback: string): string =>
    config[key] === undefined ? fallback : readString(config[key]).slice(0, 200);
  return {
    productId: readString(config["productId"]).trim(),
    productName: readString(config["productName"]).slice(0, 80),
    amountMode: readEnum(config["amountMode"], RECORD_SALE_AMOUNT_MODES, d.amountMode),
    amount: text("amount", d.amount),
    currency: text("currency", d.currency),
    customerName: text("customerName", d.customerName),
    reference: text("reference", d.reference),
    resultVariable: VARIABLE_NAME.test(prefix) ? prefix : d.resultVariable
  };
}

/** Lo que deja el bloque en la conversación (`{venta.valor}`…), para el Pixel, la Notificación o un Condicional. */
export const RECORD_SALE_FIELDS = ["id", "estado", "producto", "valor", "moneda", "pais"] as const;
export type RecordSaleField = (typeof RECORD_SALE_FIELDS)[number];

/** Cómo se ve cada estado en `{venta.estado}`. */
export const RECORD_SALE_STATE_VALUES = { approved: "aprobada", review: "por_revisar" } as const;
