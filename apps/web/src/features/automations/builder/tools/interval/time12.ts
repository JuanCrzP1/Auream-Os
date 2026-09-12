// ---------------------------------------------------------------------------
// EL RELOJ DE DOCE HORAS: tres piezas para la persona, una cadena para el disco.
//
// POR QUÉ EXISTE, y por qué NO es un parser.
//
// Lo que había aquí antes —`parseTimeInput`— leía TEXTO LIBRE: la persona
// escribía en una caja y esta capa adivinaba qué hora quería decir. Ese diseño
// tenía un fallo que ninguna cantidad de reglas iba a cerrar: una caja de texto
// acepta texto, y «10ndjd» es texto. Cada formato nuevo que se admitía hacía el
// campo más permisivo, y más permisivo es exactamente la dirección contraria a
// la que hacía falta.
//
// LA HORA NO ES UN STRING: SON TRES DATOS —hora, minuto y mitad del día— y cada
// uno tiene un dominio cerrado y pequeño. Así que no hay nada que adivinar. La
// interfaz ofrece tres controles, cada uno sabe qué valores le pertenecen, y lo
// imposible NO SE PUEDE TECLEAR. Este módulo es ese dominio, y las dos
// traducciones entre él y el contrato.
//
// PURO Y SIN NAVEGADOR. Ni React, ni DOM, ni el idioma del sistema. Los
// dominios son tan pequeños que se pueden agotar a mano en una prueba, que es
// justo lo que no se podía hacer con el control nativo ni con el parser.
//
// DOCE HORAS ARRIBA, VEINTICUATRO ABAJO. Lo que se ve y se pulsa son doce horas
// con a. m./p. m., que es como se dice la hora en Colombia. Lo que se guarda
// sigue siendo `HH:mm` de veinticuatro, byte por byte igual que antes: EL
// CONTRATO NO SE MUEVE y ningún nodo guardado necesita migrarse.
// ---------------------------------------------------------------------------

/** La mitad del día. Nunca se escribe: se elige. */
export type Meridiem = "am" | "pm";

/** La hora tal y como la edita una persona, en sus tres piezas. */
export interface Time12 {
  /** «01»–«12». Cadena y no número: «08» y «8» son el mismo dato escrito distinto. */
  readonly hour: string;
  /** «00»–«59». */
  readonly minute: string;
  readonly meridiem: Meridiem;
}

/** Una o dos cifras ASCII. `\d` en JavaScript no admite otros alfabetos. */
const UNA_O_DOS_CIFRAS = /^\d{1,2}$/;

/** Hora de pared de veinticuatro, que es lo que guarda el contrato. */
const HORA_24 = /^([01]\d|2[0-3]):([0-5]\d)$/;

const dos = (n: number) => String(n).padStart(2, "0");

/**
 * ¿Puede el campo de HORA contener esto MIENTRAS SE EDITA?
 *
 * Esta es la pregunta que sustituye al parser, y la que hace que «10ndjd» no
 * llegue a existir: no se valida DESPUÉS de aceptar, se decide SI SE ACEPTA. El
 * control llama a esto en cada pulsación y descarta la que no pertenece al
 * dominio, así que el estado nunca pasa por un valor imposible.
 *
 * VACÍO SÍ, y es la única concesión: borrar para reescribir es un gesto normal
 * y el campo tiene que poder quedarse en blanco un momento. Eso lo hace
 * EDITABLE, no GUARDABLE — las dos preguntas son distintas y las responden dos
 * funciones distintas (ver `esHoraCompleta`).
 *
 * «0» SÍ, «00» NO. El cero suelto es el primer paso de «08», así que negarlo
 * haría imposible escribir las ocho con el cero delante. «00» ya no es un paso
 * intermedio de nada: en un reloj de doce no existe la hora cero.
 *
 * Lo demás cae por el mismo sitio: «13» porque pasa de doce —el segundo dígito
 * sencillamente no entra—, «1x» y «abc» porque no son cifras, y «123» porque
 * ninguna hora tiene tres.
 */
export function aceptaHora(texto: string): boolean {
  if (texto === "") return true;
  if (!UNA_O_DOS_CIFRAS.test(texto)) return false;
  if (texto === "00") return false;

  return Number(texto) <= 12;
}

/**
 * ¿Puede el campo de MINUTOS contener esto mientras se edita?
 *
 * Mismo principio y mismo vacío temporal. Aquí el cero sí es un minuto de pleno
 * derecho —«00» son las en punto—, así que no hay excepción que hacer: basta
 * con que sean una o dos cifras y no pasen de cincuenta y nueve. Por eso «60»
 * no se puede teclear: el cero final no entra.
 */
export function aceptaMinuto(texto: string): boolean {
  if (texto === "") return true;
  if (!UNA_O_DOS_CIFRAS.test(texto)) return false;

  return Number(texto) <= 59;
}

/**
 * ¿Es ya una hora ENTERA, de las que se pueden guardar?
 *
 * Se separa de `aceptaHora` a propósito: «» y «0» se pueden TECLEAR pero no
 * significan ninguna hora, y confundir las dos cosas es lo que llevaría a
 * inventar un valor por el usuario o a guardar a medias.
 */
export function esHoraCompleta(texto: string): boolean {
  return aceptaHora(texto) && texto !== "" && Number(texto) >= 1;
}

/** ¿Es ya un minuto entero? Cualquier cifra lo es; el vacío no. */
export function esMinutoCompleto(texto: string): boolean {
  return aceptaMinuto(texto) && texto !== "";
}

/**
 * ¿Puede esta hora CRECER todavía con otra cifra?
 *
 * Es lo que decide el AUTOAVANCE, y por eso no se resuelve contando caracteres:
 * se le pregunta al dominio. «1» puede crecer —10, 11 y 12 existen—, así que el
 * foco se queda esperando el segundo dígito. «2» no puede —de 20 a 29 no hay
 * ninguna hora—, así que ya es una hora terminada y no tiene sentido retener el
 * cursor ahí. Con dos cifras nunca puede crecer.
 *
 * Contar caracteres habría dado la respuesta equivocada justo en los casos
 * cómodos: obligaría a teclear «02» donde «2» ya es inequívoco.
 */
export function horaPuedeCrecer(texto: string): boolean {
  if (texto.length >= 2) return false;

  for (let cifra = 0; cifra <= 9; cifra += 1) {
    if (aceptaHora(`${texto}${cifra}`)) return true;
  }

  return false;
}

/**
 * La forma canónica de lo tecleado: «8» se lee «08».
 *
 * SOLO CUANDO YA ESTÁ COMPLETO. A medias se devuelve intacto, porque rellenar
 * con ceros lo que la persona no ha terminado de escribir sería inventarle un
 * valor —«0» pasaría a ser «00», que ni siquiera es una hora—. Lo usa el
 * control al SALIR del campo, nunca mientras se teclea: reformatear a media
 * palabra es justo la sensación de pelearse con el campo que aquí no queremos.
 */
export function normalizarHora(texto: string): string {
  return esHoraCompleta(texto) ? dos(Number(texto)) : texto;
}

/** Lo mismo para los minutos: «5» se lee «05». */
export function normalizarMinuto(texto: string): string {
  return esMinutoCompleto(texto) ? dos(Number(texto)) : texto;
}

/**
 * De las tres piezas a lo que se guarda: `HH:mm` de veinticuatro horas.
 *
 * FUNCIÓN PURA Y ÚNICA FRONTERA. Todo lo que la interfaz sabe de la hora sale
 * de aquí, y por eso la aritmética de las doce está escrita una sola vez.
 *
 * LAS DOCE SON EL CASO RARO y el que se escribe mal en todas partes: las 12
 * a. m. son medianoche —«00»— y las 12 p. m. son mediodía —«12»—, no al revés.
 * Está en dos líneas, aquí, en lugar de repartido por los componentes.
 *
 * `null` significa «esto todavía no es una hora», no «el usuario se equivocó»:
 * un campo a medio rellenar llega hasta aquí igual que uno terminado, y quien
 * llama decide qué hacer con cada caso.
 */
export function to24Hour(hour: string, minute: string, meridiem: Meridiem): string | null {
  if (!esHoraCompleta(hour) || !esMinutoCompleto(minute)) return null;

  const h = Number(hour);
  const m = Number(minute);

  const h24 = meridiem === "am" ? (h === 12 ? 0 : h) : h === 12 ? 12 : h + 12;

  return `${dos(h24)}:${dos(m)}`;
}

/**
 * La inversa: de lo guardado a las tres piezas que se pintan.
 *
 * Es lo que hace que reabrir un nodo enseñe «02 : 45» con «p. m.» pulsado sin
 * que nadie guarde el meridiano en disco — se deduce de la hora, que es la
 * única verdad. `null` si lo guardado no es una hora de pared legible.
 */
export function from24Hour(hhmm: string): Time12 | null {
  const encontrado = HORA_24.exec(hhmm);
  if (encontrado === null) return null;

  const h24 = Number(encontrado[1]);

  return {
    hour: dos(h24 % 12 === 0 ? 12 : h24 % 12),
    minute: encontrado[2],
    meridiem: h24 < 12 ? "am" : "pm"
  };
}

/**
 * La hora guardada, escrita como se lee: «02:45 p.m.».
 *
 * Es para TEXTO CORRIDO —el resumen del nodo y la tarjeta del lienzo—, no para
 * el control: ahí la hora son tres piezas separadas y no una frase. Devuelve
 * `null` si lo guardado no es una hora, para que quien resuma enseñe el dato
 * crudo en vez de inventarle un formato.
 */
export function formatearEnDoce(hhmm: string): string | null {
  const leida = from24Hour(hhmm);
  if (leida === null) return null;

  return `${leida.hour}:${leida.minute} ${leida.meridiem === "am" ? "a.m." : "p.m."}`;
}
