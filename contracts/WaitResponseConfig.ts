// ---------------------------------------------------------------------------
// Configuración de la herramienta «Esperar respuesta» (nodo `question`).
//
// POR QUÉ VIVE EN `contracts/` Y NO EN LA CARPETA DE LA HERRAMIENTA
//
// Es el ÚNICO contrato de nodo que leen las dos orillas: el editor del builder
// lo escribe y `QuestionNodeHandler` lo ejecuta. `contracts/` es la única ruta
// compartida entre `apps/web` y el backend (`@contracts/*` → `/contracts/*`),
// así que un tipo declarado en `tools/wait-response/` sería invisible para el
// motor y obligaría a redeclarar la misma forma dos veces —dos verdades sobre
// el mismo dato, divergiendo en la primera ampliación—.
//
// Compárese con Mensaje, cuyo lector (`readMessageConfig.ts`) SÍ vive en su
// carpeta: `MessageNodeHandler` solo lee `content.text` y nunca necesita la
// forma de `config.items`. Cuando la forma no cruza al motor, no sube a
// `contracts/`. Esta sí cruza.
//
// PURO: sin React, sin Node, sin dependencias. Lo importan un componente de
// navegador y un handler de servidor.
// ---------------------------------------------------------------------------

/**
 * Unidades de espera ofrecidas.
 *
 * Minutos y horas, y solo esas dos. No hay segundos —una espera de respuesta
 * humana en segundos no es un caso real— ni días, que exigirían hablar de
 * husos horarios y caducidad de sesión, decisiones que no están tomadas.
 */
export type WaitResponseTimeUnit = "minutes" | "hours";

/** Cuánto se espera como máximo, cuando hay límite. */
export interface WaitResponseTimeout {
  readonly amount: number;
  readonly unit: WaitResponseTimeUnit;
}

/**
 * Lo que el usuario configura en un nodo «Esperar respuesta».
 *
 * `content.text` NO está aquí: el mensaje que se envía antes de esperar es
 * CONTENIDO del nodo, no configuración, y el motor ya lo lee de `content.text`
 * desde antes de esta herramienta. Mantener esa frontera es lo que permite que
 * el mensaje siga viajando por el mismo camino que el de cualquier otro nodo.
 */
export interface WaitResponseConfig {
  /**
   * Esperar sin límite.
   *
   * `true` —el valor por defecto— es lo que el motor sabe hacer HOY sin ninguna
   * pieza nueva: la sesión queda en `waiting_input` y despierta con el siguiente
   * mensaje del cliente, sin caducidad.
   */
  readonly waitIndefinitely: boolean;

  /**
   * Tiempo máximo de espera. Solo se interpreta si `waitIndefinitely` es
   * `false`; su ausencia con `waitIndefinitely: false` es una configuración
   * incompleta y `validateWaitResponse` la rechaza.
   */
  readonly timeout?: WaitResponseTimeout;

  /**
   * Agrupar los mensajes que llegan seguidos y tratarlos como una respuesta.
   *
   * DATO MODELADO, COMPORTAMIENTO PENDIENTE. Agrupar exige un búfer de entrada
   * —retener el primer mensaje unos segundos por si llegan más— y esa capa no
   * existe en la plataforma: `RuntimeInput` entrega un envelope y el loop lo
   * ejecuta. Se persiste con su forma final y el handler lo declara en
   * `nodeResult` para que el día que exista el búfer no haya que migrar nada ni
   * volver a preguntárselo al usuario. Mismo criterio que `sendOnce` en Mensaje.
   */
  readonly groupMessages: boolean;

  /**
   * Enviar el mensaje de este nodo como respuesta citada al último mensaje del
   * cliente.
   *
   * Se resuelve con `InboundEnvelope.messageId`, que ya existe: no hace falta
   * inventar ninguna API de canal. Lo que este nodo emite se marca con
   * `OutboundMessage.replyToMessageId`; entregarlo como cita es asunto del
   * adaptador de canal, que se construirá en la Fase D.
   */
  readonly replyToInbound: boolean;

  /**
   * Emoji con el que reaccionar al mensaje que el cliente envía como respuesta.
   *
   * ES EL PROPIO EMOJI, no un booleano: una reacción sin emoji no significa
   * nada, y un booleano habría dejado la elección escondida en el código en vez
   * de en la configuración. Ausente o vacío = no se reacciona.
   */
  readonly reaction?: string;

  /**
   * Nombre del campo de la conversación donde se guarda la respuesta.
   *
   * Se llama `targetKey` porque es el nombre que `QuestionNodeHandler` ya lee
   * desde antes de esta herramienta —cambiarlo habría roto los nodos guardados
   * sin ganar nada—. En la interfaz nunca se muestra este nombre: allí se lee
   * «Guardar respuesta en».
   */
  readonly targetKey?: string;
}

/**
 * Espera que se propone por defecto, y a la que se vuelve al retirar el «sin
 * límite».
 *
 * Declarada ANTES que `WAIT_RESPONSE_DEFAULT_CONFIG` porque esta la usa: el
 * contrato es el dueño único de este valor. Estaba escrito tres veces en el
 * editor —el valor que se propone y dos respaldos del control—, y tres copias
 * de un default son tres sitios donde cambiarlo a medias.
 */
export const WAIT_RESPONSE_DEFAULT_TIMEOUT: WaitResponseTimeout = {
  amount: 30,
  unit: "minutes"
};

/**
 * Configuración con la que nace un nodo «Esperar respuesta».
 *
 * Nace con un tiempo máximo de 30 minutos, no con «sin límite»: es el estado
 * inicial que el producto pide mostrar en el editor —el interruptor apagado y
 * el tiempo máximo ya editable—, una decisión de UX explícita y no la
 * deducción de «lo que el motor ejecuta hoy» que regía antes.
 *
 * ES HONESTO DECIRLO: el motor todavía NO hace vencer ningún timeout —eso es
 * Fase C, ver la cabecera de `QuestionNodeHandler`—, así que un nodo recién
 * creado con este default espera en la práctica indefinidamente, aunque su
 * editor muestre 30 minutos. `waitTimeoutMs`/`waitDeadlineAt` en `nodeResult`
 * siguen siendo honestos sobre esto: declaran cuánto DEBERÍA vencer la espera,
 * no cuánto vence hoy. No es un defecto de este cambio: es el mismo estado de
 * la Fase C que ya existía, ahora simplemente visible desde el primer nodo.
 */
export const WAIT_RESPONSE_DEFAULT_CONFIG: WaitResponseConfig = {
  waitIndefinitely: false,
  timeout: WAIT_RESPONSE_DEFAULT_TIMEOUT,
  groupMessages: false,
  replyToInbound: false
};

/** Duración de una unidad, en milisegundos. */
const MS_POR_UNIDAD: Readonly<Record<WaitResponseTimeUnit, number>> = {
  minutes: 60_000,
  hours: 3_600_000
};

/** `true` si la unidad es una de las dos que la herramienta ofrece. */
export function esUnidadValida(unit: unknown): unit is WaitResponseTimeUnit {
  return unit === "minutes" || unit === "hours";
}

/**
 * `true` si la cantidad es una espera expresable: entera y positiva.
 *
 * Se exige entera porque «2,5 horas» no es algo que el control ofrezca ni que
 * el usuario pueda haber escrito, y aceptarla dejaría entrar un valor que
 * ningún camino de la interfaz produce.
 */
export function esCantidadValida(amount: unknown): amount is number {
  return typeof amount === "number" && Number.isInteger(amount) && amount > 0;
}

/**
 * Lee la configuración de un nodo `question` sin confiar en ella.
 *
 * DEFENSIVO A PROPÓSITO, igual que `readMessageItems`: lo que llega es JSON de
 * disco o de red que pudo escribirse con una versión anterior de la
 * herramienta. Un campo corrupto no puede hacer caer ni el editor ni el motor;
 * cae al valor por defecto y lo que quede mal configurado lo dirá la validación,
 * que es quien tiene voz para eso.
 *
 * NO INVENTA: si `waitIndefinitely` no viene, se asume `true` —el
 * comportamiento que el motor sí sabe hacer—, no un límite que nadie pidió.
 *
 * ESTE FALLBACK ES DISTINTO, A PROPÓSITO, DE `WAIT_RESPONSE_DEFAULT_CONFIG`.
 * Este lee un dato AUSENTE —un JSON viejo, corrupto, o literalmente vacío— y su
 * criterio es la seguridad: no interpretar un límite que nadie escribió. Aquel
 * es el estado con el que nace un nodo NUEVO desde la paleta, y su criterio es
 * el producto: mostrar el editor con el tiempo máximo ya listo. Que difieran no
 * es una inconsistencia; son dos preguntas distintas —«¿qué hago con esto que
 * falta?» y «¿qué le doy a alguien que no ha escrito nada todavía?»—.
 */
export function readWaitResponseConfig(
  config: Readonly<Record<string, unknown>>
): WaitResponseConfig {
  const timeoutBruto = config.timeout;
  const timeout =
    typeof timeoutBruto === "object" && timeoutBruto !== null
      ? (timeoutBruto as Record<string, unknown>)
      : null;

  const amount = timeout?.amount;
  const unit = timeout?.unit;

  // EL DESTINO SE NORMALIZA AL LEERLO, no solo al ejecutarlo.
  //
  // `resolveContextKey` ya quitaba el prefijo `context.` en el motor, pero el
  // lector se limitaba a recortar espacios: con `context.ciudad` guardado, la
  // tarjeta y el resumen decían «Guarda en context.ciudad» mientras el runtime
  // escribía en `ciudad`. El usuario leía un nombre de campo que no era el que
  // se usaba, y `context.` es además un detalle técnico que no le pertenece.
  //
  // Normalizando aquí hay UN SOLO normalizador —el de siempre— y todas las
  // superficies que leen la configuración (editor, resumen, nodo cerrado y
  // motor) ven exactamente la misma clave, también en los nodos ya guardados.
  // El motor sigue llamando a `resolveContextKey`: sobre una clave ya normalizada
  // es idempotente, y así no depende de que quien le pase la configuración la
  // haya leído por aquí.
  const targetKey = resolveContextKey(config.targetKey) ?? "";
  const reaction = typeof config.reaction === "string" ? config.reaction.trim() : "";

  return {
    // Solo un `false` explícito quita el «sin límite». Cualquier otra cosa
    // —ausente, nula, basura— deja el nodo en lo que el motor ejecuta hoy.
    waitIndefinitely: config.waitIndefinitely !== false,
    ...(esCantidadValida(amount) && esUnidadValida(unit)
      ? { timeout: { amount, unit } }
      : {}),
    groupMessages: config.groupMessages === true,
    replyToInbound: config.replyToInbound === true,
    ...(reaction.length > 0 ? { reaction } : {}),
    ...(targetKey.length > 0 ? { targetKey } : {})
  };
}

/**
 * Espera máxima en milisegundos, o `null` si se espera sin límite.
 *
 * Vive en el contrato y no en el handler ni en el editor porque los tres
 * necesitan la misma cuenta: el motor para declarar el vencimiento, el editor
 * para resumirlo y los tests para comprobarlo. Una sola aritmética, un solo
 * sitio donde equivocarse.
 */
export function waitResponseTimeoutMs(config: WaitResponseConfig): number | null {
  if (config.waitIndefinitely || !config.timeout) return null;

  return config.timeout.amount * MS_POR_UNIDAD[config.timeout.unit];
}

/**
 * Normaliza la clave del campo donde se guarda la respuesta.
 *
 * Acepta `nombre` y `context.nombre` y devuelve siempre la forma sin prefijo,
 * que es la que `EdgeEvaluator` y las plantillas `{{context.x}}` resuelven
 * contra `session.context`. Guardarla con el prefijo dejaría el valor escrito
 * pero ilegible para ambos.
 *
 * Estaba dentro de `QuestionNodeHandler` como función privada; sube aquí sin
 * cambiar su comportamiento porque ahora también la necesita la validación del
 * editor, y dos copias de esta regla habrían divergido a la primera.
 */
export function resolveContextKey(targetKey: unknown): string | null {
  if (typeof targetKey !== "string" || targetKey.trim().length === 0) {
    return null;
  }

  return targetKey.trim().replace(/^context\./, "");
}
