// ---------------------------------------------------------------------------
// Campos del cliente (Configuración › Datos › Campos del cliente): los datos
// que la cuenta guarda de cada cliente, con nombre, clave y TIPO. La clave es
// lo que se escribe en los mensajes (`{ciudad}`) y la que usan los bloques.
//
// Definir un campo no cambia los flujos: le da nombre, tipo y lugar en la
// ficha, y desde ese momento lo que un bloque guarde con esa clave queda
// también en el cliente (convertido a su tipo). Contrato API ↔ web.
// ---------------------------------------------------------------------------

export const CONTACT_FIELD_TYPES = ["text", "number", "date", "boolean", "list"] as const;
export type ContactFieldType = (typeof CONTACT_FIELD_TYPES)[number];

export const CONTACT_FIELD_TYPE_LABEL: Readonly<Record<ContactFieldType, string>> = {
  text: "Texto",
  number: "Número",
  date: "Fecha",
  boolean: "Sí o no",
  list: "Lista"
};

export const CONTACT_FIELD_LIMITS = {
  maxFields: 100,
  maxLabel: 40,
  maxKey: 40,
  minOptions: 2,
  maxOptions: 30,
  maxOption: 40
} as const;

/** Para comparar textos: sin tildes, sin mayúsculas, sin espacios de más. */
export function foldFieldText(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** La clave que sale de un nombre: «Producto de interés» → `producto_de_interes`. Igual en la web y en el servidor. */
export function keyFromLabel(label: string): string {
  return foldFieldText(label).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "c_$1").slice(0, CONTACT_FIELD_LIMITS.maxKey);
}

export interface ContactFieldDefinition {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly type: ContactFieldType;
  /** Solo en tipo lista: las opciones, en orden. */
  readonly options: ReadonlyArray<string>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Un bloque de un flujo que llena o lee el campo. */
export interface FieldUse {
  readonly flowKey: string;
  readonly flowName: string;
  readonly blockId: string;
  readonly blockName: string;
  /** El tipo del bloque (`question`, `menu`, `integration`, `ai`…): dice cómo se llenó («Lo respondió», «Lo eligió»). */
  readonly blockType: string;
  /** fills: lo guarda (Esperar respuesta, Menú, Integración, IA) · reads: lo usa en un texto o una condición. */
  readonly role: "fills" | "reads";
}

export interface ContactFieldSummary extends ContactFieldDefinition {
  /** Clientes que tienen el dato. */
  readonly filled: number;
  readonly uses: ReadonlyArray<FieldUse>;
}

/** Los que llena Auream: se usan igual, no se editan ni se borran. */
export interface SystemContactField {
  readonly key: string;
  readonly label: string;
  /** De dónde sale el dato. */
  readonly source: string;
  readonly example: string;
}

export const SYSTEM_CONTACT_FIELDS: ReadonlyArray<SystemContactField> = [
  { key: "first_name", label: "Primer nombre", source: "De WhatsApp o de su ficha", example: "Laura" },
  { key: "full_name", label: "Nombre completo", source: "De WhatsApp o de su ficha", example: "Laura Gómez" },
  { key: "phone", label: "Teléfono", source: "Su número de WhatsApp", example: "573001110001" },
  { key: "email", label: "Correo", source: "De su ficha", example: "laura@correo.com" },
  { key: "last_message", label: "Último mensaje", source: "Lo último que escribió", example: "¿cuánto cuesta?" },
  { key: "fecha", label: "Fecha", source: "Hoy, en la zona de tu negocio", example: "13/11/2026" },
  { key: "hora", label: "Hora", source: "Ahora, en la zona de tu negocio", example: "14:35" },
  { key: "source_id", label: "Anuncio de origen", source: "El anuncio de Meta por el que llegó", example: "120244134508290395" }
];

/** Claves que no puede tomar un campo propio (las del sistema y las que usa el motor). */
export const RESERVED_FIELD_KEYS: ReadonlySet<string> = new Set([
  ...SYSTEM_CONTACT_FIELDS.map((field) => field.key),
  "name", "data", "source_url", "media_url", "thumbnail_url", "ctwa_clid", "comprobante", "venta"
]);

export interface ContactFieldsResponse {
  readonly fields: ReadonlyArray<ContactFieldSummary>;
  readonly system: ReadonlyArray<SystemContactField>;
  /** Clientes de la cuenta (para «lleno en X de Y»). */
  readonly totalContacts: number;
  /** Datos que tus flujos o integraciones guardan y aún no son campos (para «el primer día»). */
  readonly undefinedKeys: number;
  readonly canManage: boolean;
}

export interface SaveContactFieldRequest {
  readonly label: string;
  /** Al crear: la clave (si no viene, sale del nombre). No se cambia después: los flujos la usan. */
  readonly key?: string;
  readonly type: ContactFieldType;
  readonly options?: ReadonlyArray<string>;
}

/** Un dato que ya guardan tus flujos o integraciones y aún no es un campo. */
export interface DiscoveredField {
  readonly key: string;
  readonly suggestedLabel: string;
  readonly suggestedType: ContactFieldType;
  readonly suggestedOptions: ReadonlyArray<string>;
  /** Clientes que ya lo tienen guardado. */
  readonly filled: number;
  /** Formas distintas en que está escrito (para avisar «14 formas»). */
  readonly distinctValues: number;
  readonly uses: ReadonlyArray<FieldUse>;
  /** Claves que parecen el mismo dato con otro nombre (`resposta` ~ `respuesta`). */
  readonly similarTo: ReadonlyArray<string>;
  /** Dato técnico de una integración (ids, estados, errores): mejor no mostrarlo. */
  readonly technical: boolean;
}

export interface DiscoveryResponse {
  readonly suggestions: ReadonlyArray<DiscoveredField>;
}

export interface AdoptFieldsRequest {
  readonly fields: ReadonlyArray<SaveContactFieldRequest & { readonly key: string }>;
}

/** Borrar exige escribir la clave (`DELETE /contact-fields/:id?confirm=<clave>`): se pierde el dato de todos los clientes. */
export const CONTACT_FIELD_CONFIRM_PARAM = "confirm";
