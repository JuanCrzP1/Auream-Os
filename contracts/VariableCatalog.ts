import { AD_VARIABLES } from "./AdOrigin";
import { PAYMENT_PROOF_FIELDS } from "./PaymentProofConfig";
import { BUILT_IN_VARIABLES } from "./TemplateVariables";

// ---------------------------------------------------------------------------
// El catálogo de variables que ofrece el editor (el botón «{ }» de cada campo
// de texto) y los NOMBRES DE LEONA que Auream también entiende, para que un
// flujo traído de allá funcione sin cambiarlo.
//
// Un alias solo se usa si la variable no existe con su propio nombre: si un
// flujo guardó su propio `{comprovante.valor}`, ese manda.
// ---------------------------------------------------------------------------

/** Nombre de Leona → nombre de Auream. */
export const LEONA_VARIABLE_ALIASES: Readonly<Record<string, string>> = {
  phone_number: "phone",
  "ai.response": "ia.respuesta",
  "ai.erro": "ia.error",
  "ai.fail.reason": "ia.error",
  "response.erro": "integracion.error",
  "comprovante.valor": "comprobante.valor",
  "comprovante.currency": "comprobante.moneda",
  "comprovante.banco": "comprobante.banco",
  "comprovante.data": "comprobante.fecha",
  "comprovante.nome_pagador": "comprobante.nombre_pagador",
  "comprovante.nome_recebedor": "comprobante.titular_destino"
};

/** El nombre de Auream de una variable de Leona (o `undefined` si no es una). */
export const variableAlias = (name: string): string | undefined => LEONA_VARIABLE_ALIASES[name];

/** Lo que guarda la Integración cuando falla: el motivo, para avisar o decidir. */
export const INTEGRATION_ERROR_VARIABLE = "integracion.error";

export interface CatalogVariable {
  readonly name: string;
  readonly label: string;
}

export interface VariableGroup {
  readonly id: "contact" | "system" | "ad" | "blocks";
  readonly title: string;
  readonly variables: ReadonlyArray<CatalogVariable>;
}

const CONTACT = new Set(["first_name", "full_name", "phone", "email", "last_message", "created_at", "attendant_name"]);

const PROOF_LABEL: Readonly<Record<(typeof PAYMENT_PROOF_FIELDS)[number], string>> = {
  valor: "monto",
  moneda: "moneda",
  fecha: "fecha",
  banco: "banco",
  cuenta_destino: "cuenta que recibió",
  titular_destino: "titular que recibió",
  nombre_pagador: "quién pagó",
  referencia: "referencia"
};

/** Las variables fijas, por grupo (los campos del cliente y los datos del negocio los suma el editor). */
export const VARIABLE_GROUPS: ReadonlyArray<VariableGroup> = [
  { id: "contact", title: "Del cliente", variables: BUILT_IN_VARIABLES.filter((variable) => CONTACT.has(variable.name)) },
  { id: "system", title: "Del sistema", variables: BUILT_IN_VARIABLES.filter((variable) => !CONTACT.has(variable.name)) },
  {
    id: "ad",
    title: "Del anuncio",
    variables: Object.keys(AD_VARIABLES).map((name) => ({ name, label: name === "ctwa_clid" ? "Identificador del clic (Meta)" : `Anuncio: ${name.replace(/_/g, " ")}` }))
  },
  {
    id: "blocks",
    title: "De otros bloques",
    variables: [
      { name: "ia.respuesta", label: "Respuesta de la IA" },
      { name: "ia.error", label: "Error de la IA" },
      { name: INTEGRATION_ERROR_VARIABLE, label: "Error de la integración" },
      ...PAYMENT_PROOF_FIELDS.map((field) => ({ name: `comprobante.${field}`, label: `Comprobante: ${PROOF_LABEL[field]}` })),
      { name: "venta.valor", label: "Venta: monto" },
      { name: "venta.moneda", label: "Venta: moneda" },
      { name: "venta.producto", label: "Venta: producto" },
      { name: "venta.estado", label: "Venta: estado" }
    ]
  }
];
