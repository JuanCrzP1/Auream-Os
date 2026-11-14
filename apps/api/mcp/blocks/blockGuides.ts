import type { NodeType } from "../../../../contracts/FlowSnapshot";
import { RULE_CATEGORIES, ruleOperators } from "../../../../contracts/ConditionConfig";
import { LEONA_VARIABLE_ALIASES } from "../../../../contracts/VariableCatalog";
import { BUILT_IN_VARIABLES } from "../../../../contracts/TemplateVariables";

// ---------------------------------------------------------------------------
// Cómo se configura cada bloque, explicado para un agente de IA: qué hace,
// sus campos, sus salidas y un ejemplo listo. Es DOCUMENTACIÓN: las reglas
// (valores por defecto, forma canónica, salidas, validación) son las de
// `contracts/blocks` y se aplican al guardar, digan lo que digan estas líneas.
// ---------------------------------------------------------------------------

export interface BlockGuide {
  readonly purpose: string;
  readonly fields: Readonly<Record<string, string>>;
  readonly outputs: string;
  readonly example: Readonly<Record<string, unknown>>;
}

export const VARIABLES_NOTE = `Los textos admiten variables entre llaves: ${BUILT_IN_VARIABLES.map((v) => `{${v.name}}`).join(", ")}, los campos personalizados del contacto ({ciudad}), los guardados por otros bloques ({ia.respuesta}) y los Datos del negocio de la cuenta ({g_horario}; de list_flow_resources, solo se leen; si tienen un cambio programado, dicen ese valor mientras rige y luego vuelven solos al de siempre). Con valor por defecto: {first_name|amigo}. También valen los nombres de Leona: ${Object.keys(LEONA_VARIABLE_ALIASES).map((name) => `{${name}}`).join(", ")}. Si una Integración falla, el motivo queda en {integracion.error}.`;

const conditionCategories = RULE_CATEGORIES.map((category) => `${category} (${ruleOperators(category).join("/")})`).join("; ");

export const BLOCK_GUIDES: Readonly<Partial<Record<NodeType, BlockGuide>>> = {
  message: {
    purpose: "Envía al cliente uno o varios contenidos en orden (texto, imagen, video, audio, documento) y sigue.",
    fields: {
      items: "Lista en orden. Texto: {kind:'text', text}. Medio: {kind:'image'|'video'|'audio'|'file', url (https pública o una variable que traiga el enlace al enviar, como '{kie.ai.result}' o '{portada}'; si al enviar no es un enlace, ese medio no sale), caption?, fileName?, sendOnce? (solo la primera vez), viewOnce? (ver una sola vez de WhatsApp: el cliente lo abre una vez y se borra; solo image, video o audio)}. Pausa entre envíos: {kind:'interval', amount, unit:'seconds'|'minutes'|'hours'}."
    },
    outputs: "Una sola salida.",
    example: { items: [{ kind: "text", text: "¡Hola {first_name}! 👋" }, { kind: "interval", amount: 2, unit: "seconds" }, { kind: "text", text: "¿En qué te ayudo?" }] }
  },
  question: {
    purpose: "Espera a que el cliente responda; puede guardar la respuesta en un campo.",
    fields: {
      waitIndefinitely: "true: espera sin límite. false: usa «timeout».",
      timeout: "{amount (entero > 0), unit:'minutes'|'hours'} — cuánto esperar como máximo.",
      targetKey: "Campo donde guardar la respuesta (letras, números, _ o -), p. ej. 'nombre'. Luego se usa como {nombre}. Si es un Campo del cliente, la respuesta queda también en su ficha, convertida a su tipo.",
      onMismatch: "'retry' (opcional): si targetKey es un Campo del cliente con tipo (lista, número, fecha, sí o no) y la respuesta no encaja, vuelve a preguntar hasta 2 veces; después sigue.",
      retryMessage: "Texto al volver a preguntar (opcional; por defecto, uno según el tipo: «Elige una de estas: …»).",
      groupMessages: "true: junta varios mensajes seguidos del cliente en una sola respuesta.",
      replyToInbound: "true: responde citando el mensaje del cliente.",
      reaction: "Emoji con el que reaccionar a la respuesta (opcional)."
    },
    outputs: "«respuesta» y, si hay tiempo máximo, «tiempo-agotado».",
    example: { waitIndefinitely: false, timeout: { amount: 30, unit: "minutes" }, targetKey: "nombre" }
  },
  menu: {
    purpose: "Envía un menú interactivo de WhatsApp (lista o botones) y sigue por la opción elegida.",
    fields: {
      format: "'list' (hasta 10 opciones, títulos de 24 caracteres) o 'buttons' (hasta 3, títulos de 20).",
      message: "Texto del menú (obligatorio).",
      title: "Encabezado (opcional).",
      buttonLabel: "Texto del botón que abre la lista (solo 'list').",
      footer: "Pie (opcional).",
      options: "[{id?, title, description? (solo 'list')}]. Cada opción es una SALIDA: su id. Al editar, conserva los ids para no perder conexiones.",
      saveToField: "Campo donde guardar la opción elegida (opcional).",
      timeoutEnabled: "true para dejar de esperar tras un tiempo.",
      timeoutAmount: "Entero ≥ 1.",
      timeoutUnit: "'minutes' | 'hours' | 'days'."
    },
    outputs: "Una por opción (su id), «menu-other» (escribió otra cosa; puede volver al mismo menú) y, con tiempo límite, «menu-timeout».",
    example: { format: "buttons", message: "¿Qué te interesa?", options: [{ title: "Precios" }, { title: "Asesor" }] }
  },
  tags: {
    purpose: "Pone o quita etiquetas al contacto (las que no existen se crean). Si la etiqueta es una etapa de un embudo del CRM, el cliente pasa a esa etapa (y sale de la anterior del mismo embudo).",
    fields: { action: "'add' | 'remove'.", tags: "Nombres de etiquetas: ['VIP', 'cliente']." },
    outputs: "Una sola salida.",
    example: { action: "add", tags: ["interesado"] }
  },
  condition: {
    purpose: "Evalúa reglas y sigue por «se cumple» o «no se cumple».",
    fields: {
      match: "'all' (todas) | 'any' (cualquiera).",
      rules: `[{category, operator, field?, value?}]. Categorías (operadores): ${conditionCategories}. «field» para contactField (name/email/phone), customField y globalVariable (la clave g_… de un dato del negocio, con su tipo como customField). «value»: etiqueta, día (monday…sunday), hora HH:MM, fecha AAAA-MM-DD o texto; el valor puede llevar variables ({data}, {ref_anterior}). customField con tipo: is_one_of/is_none_of (opciones de la lista, una por línea en «value»), between («desde\\nhasta»), anniversary_today (sin valor: hoy es su día y mes), within_next_days/at_least_days_ago (N días), before_date/after_date (AAAA-MM-DD). Un sí o no se compara con «Sí»/«No».`
    },
    outputs: "«true» (se cumple) y «false» (no se cumple).",
    example: { match: "all", rules: [{ category: "tag", operator: "equal", value: "VIP" }] }
  },
  distributor: {
    purpose: "Reparte las conversaciones por turnos entre sus salidas (p. ej. entre asesores o variantes).",
    fields: { outputs: "[{id?, label}] — cada una es una salida." },
    outputs: "Una por cada elemento de «outputs» (su id).",
    example: { outputs: [{ label: "Asesor A" }, { label: "Asesor B" }] }
  },
  delay: {
    purpose: "Programador: decide cuándo continúa la conversación (tras un tiempo o en una fecha), opcionalmente dentro de un horario.",
    fields: {
      trigger: "'interval' (esperar un tiempo) | 'date' (continuar en una fecha y hora).",
      wait: "{amount (entero > 0), unit:'seconds'|'minutes'|'hours'|'days'} — con 'interval' (máximo 31 días).",
      moment: "{date:'AAAA-MM-DD', time:'HH:MM'} — con 'date'.",
      scheduleEnabled: "true para continuar solo dentro del horario.",
      schedule: "{monday:{enabled, ranges:[{start:'09:00', end:'18:00'}]}, … sunday}."
    },
    outputs: "Una sola salida.",
    example: { trigger: "interval", wait: { amount: 10, unit: "minutes" } }
  },
  ai: {
    purpose: "Extensión IA: llama a un modelo con un mensaje y guarda la respuesta; puede clasificar en intenciones (una salida por intención).",
    fields: {
      credentialId: "Id de la conexión de IA (de list_flow_resources). Obligatorio.",
      model: "Modelo del proveedor (p. ej. 'gpt-4o-mini', 'gemini-2.0-flash'). Obligatorio.",
      systemPrompt: "Instrucciones del asistente.",
      userMessage: "Lo que recibe la IA (por defecto '{last_message}').",
      responseVariable: "Dónde se guarda la respuesta (por defecto 'ia.respuesta').",
      autoSend: "true: envía la respuesta al cliente.",
      keepContext: "true: recuerda los últimos turnos (contextTurns, 1–20).",
      intents: "[{id?, description, key}] — hasta 10; cada una es una salida.",
      fallbackKey: "Nombre de la salida sin coincidencia (por defecto 'otro').",
      understandAudio: "true: oye la nota de voz del cliente (la del mensaje que acaba de llegar, o la de userMessage si es solo esa variable, p. ej. '{respuesta}'). Con OpenAI se transcribe antes.",
      understandImage: "true: ve la foto o captura del cliente (el modelo debe aceptar imágenes).",
      understandPdf: "true: lee el texto del PDF del cliente y se lo agrega al mensaje."
    },
    outputs: "Sin intenciones: «success» y «failure». Con intenciones: una por intención (su id), «fallback» y «failure».",
    example: { credentialId: "<id>", model: "gpt-4o-mini", systemPrompt: "Eres un asesor amable.", userMessage: "{last_message}", autoSend: true }
  },
  integration: {
    purpose: "Hace una petición HTTP a otro sistema y puede guardar datos de la respuesta en campos del contacto.",
    fields: {
      method: "'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'.",
      url: "https://… (admite variables).",
      headers: "[{key, value}].",
      body: "Texto (JSON) con variables, para POST/PUT/PATCH.",
      responseMappings: "[{path:'data.id', field:'pedido_id'}] — ruta en la respuesta y campo donde guardarla."
    },
    outputs: "«success» y «failure».",
    example: { method: "POST", url: "https://hooks.ejemplo.com/lead", body: '{"telefono":"{phone}"}' }
  },
  "payment-proof": {
    purpose: "Lee un comprobante de pago (imagen o PDF que envió el cliente) y valida cuenta, titular, monto, antigüedad y duplicados.",
    fields: {
      source: "Variable con el archivo (por defecto '{comprobante}', p. ej. guardado por Esperar respuesta).",
      accounts: "[{country:'CO', provider, number, holder, alias?}] — dónde recibes pagos.",
      matchAccount: "Exigir que vaya a una de tus cuentas.",
      matchHolder: "Exigir el titular.",
      amountCheck: "'off' | 'exact' | 'minimum' (con expectedAmount y amountCurrency).",
      maxAgeEnabled: "Rechazar si es más viejo que maxAgeHours.",
      rejectDuplicates: "Rechazar comprobantes ya usados.",
      splitRejections: "true: una salida por motivo de rechazo.",
      resultVariable: "Dónde se guardan los datos leídos (por defecto 'comprobante')."
    },
    outputs: "«valid» y «rejected»; con splitRejections: «valid», «wrong-key», «wrong-recipient», «wrong-amount», «too-old», «duplicate» (según lo activado), «invalid» y «failure».",
    example: { accounts: [{ country: "CO", provider: "nequi", number: "3001234567", holder: "Tienda Laura" }], amountCheck: "off" }
  },
  "record-sale": {
    purpose: "Guarda la venta en Ventas (va después de la salida 'válido' del Comprobante o de un pago confirmado). Si falta el producto, el monto o la moneda, la venta queda 'Por revisar' y no suma en los totales: nunca inventa un precio. Deja {venta.valor}, {venta.moneda}, {venta.producto}, {venta.estado} (aprobada · por_revisar · error) y {venta.id}.",
    fields: {
      productId: "Id de un producto ACTIVO del catálogo (Ventas → Productos). Obligatorio.",
      amountMode: "'variable' (monto y moneda de variables, lo normal tras el Comprobante) | 'product' (precio del producto en el país del cliente, por su teléfono).",
      amount: "Monto con 'variable' (por defecto '{comprobante.valor}').",
      currency: "Moneda ISO o variable con 'variable' (por defecto '{comprobante.moneda}').",
      customerName: "Nombre del cliente (por defecto '{comprobante.nombre_pagador}'; si no hay, el del contacto).",
      reference: "Referencia del pago (por defecto '{comprobante.referencia}'): el mismo comprobante no se registra dos veces."
    },
    outputs: "Una sola salida.",
    example: { productId: "<id>", amountMode: "variable", amount: "{comprobante.valor}", currency: "{comprobante.moneda}" }
  },
  "set-field": {
    purpose: "Guardar dato (el Manipulador de Leona): pone un valor en un dato del cliente o de la conversación, o hace una cuenta con el número que ya tiene. Si es un Campo del cliente, queda en su ficha. Los Datos del negocio (g_…) y los datos que llena Auream no se cambian.",
    fields: {
      field: "Clave del dato (letras, números, _, - o .), p. ej. 'cancion_video' o 'reintentos'. Luego se usa como {cancion_video}.",
      operation: "'set' (poner el valor) | 'add' | 'subtract' | 'multiply' | 'divide' (cuenta con el número que tiene; vacío cuenta como 0; si algo no es número o se divide entre 0, el dato no cambia).",
      value: "El valor (con variables: 'usada', '{cancion_2}', '{kie.ai.result}') o el número de la cuenta ('1', '{comprobante.valor}'). Obligatorio."
    },
    outputs: "Una sola salida.",
    example: { field: "cancion_video", operation: "set", value: "{cancion_2}" }
  },
  pixel: {
    purpose: "Envía un evento de conversión a Meta (Lead o Compra).",
    fields: {
      connectionId: "Id del píxel conectado (de list_flow_resources). Obligatorio.",
      event: "'lead' | 'purchase'.",
      value: "Valor de la compra (número o variable) — obligatorio con 'purchase'.",
      currency: "Código ISO de 3 letras (por defecto 'COP')."
    },
    outputs: "Una sola salida.",
    example: { connectionId: "<id>", event: "lead" }
  },
  "go-to-flow": {
    purpose: "Ir a otro flujo (la Conexión de flujo de Leona): este flujo termina y el cliente sigue, en el mismo momento, en el inicio del flujo elegido, con los datos que guardó la conversación. Si el flujo de destino está pausado, archivado o es el mismo, el salto no ocurre (queda anotado); como mucho 5 saltos seguidos.",
    fields: {
      flowId: "Id del flujo de destino (de list_flows), de la misma cuenta y activo. Obligatorio.",
      flowName: "Su nombre (para mostrarlo en el lienzo)."
    },
    outputs: "Ninguna: la conversación sigue en el otro flujo (no se le conecta nada).",
    example: { flowId: "<id de list_flows>", flowName: "Promoción" }
  },
  notification: {
    purpose: "Avisa por WhatsApp a un número del EQUIPO (no al cliente), desde el número conectado del chat.",
    fields: {
      name: "A quién se avisa (p. ej. 'Ventas').",
      countryCode: "Indicativo sin '+' (p. ej. '57').",
      phone: "Número sin indicativo (7 a 15 dígitos).",
      message: "Texto del aviso (admite variables)."
    },
    outputs: "Una sola salida.",
    example: { name: "Ventas", countryCode: "57", phone: "3001234567", message: "Nuevo lead: {full_name} ({phone})" }
  }
};
