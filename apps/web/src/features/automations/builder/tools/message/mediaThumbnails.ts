// ---------------------------------------------------------------------------
// La miniatura de un medio, para el nodo cerrado.
//
// UNA RESPONSABILIDAD: dada una fuente, devolver una imagen pequeña con la que
// representarla —o nada, si no se puede sacar ninguna—.
//
// Existe aparte porque una imagen y un video se resuelven de forma distinta y
// esa diferencia no puede vivir en el preview:
//
//   IMAGEN  su fuente YA es pintable. Se devuelve tal cual, sin trabajo.
//   VIDEO   hay que decodificarlo y sacarle un fotograma. Es asíncrono, puede
//           fallar y su resultado se reutiliza.
//
// Meter eso en el componente lo habría convertido en un gestor de recursos con
// caché y suscripciones. Aquí, el preview solo pregunta.
//
// BARATO POR CONSTRUCCIÓN:
//   - Un fotograma por fuente, cacheado. React puede renderizar mil veces.
//   - El `<video>` de trabajo se crea, se usa y se destruye. Nunca queda uno
//     vivo por nodo.
//   - Se pide UN fotograma, no el video entero: un salto a un instante cercano
//     al principio y se copia lo que haya ahí.
//   - Ancho tope pequeño, así que el resultado son unos pocos KB.
//   - Un tope de tiempo: un video que no responde no deja nada colgado.
//
// NUNCA ROMPE EL LIENZO. Cualquier fallo —códec no soportado, CORS, URL
// inaccesible, canvas contaminado, navegador sin canvas— termina en `null`, y
// `null` significa «usa el icono». El nodo se pinta igual.
// ---------------------------------------------------------------------------

import { alCambiarLaSesion, fuentesDeSesion } from "./mediaSourceSession";

/** Ancho del fotograma capturado. El preview lo enseña a 38px. */
const ANCHO_MINIATURA = 96;

/** Cuánto se espera a un video antes de rendirse. */
const TOPE_MS = 4000;

/**
 * Instantes de los que se intenta sacar el fotograma, en orden.
 *
 * NO BASTA CON UNO. Un video empieza en negro muchísimas veces —fundido de
 * entrada, claqueta, la primera décima de una grabación— y el segundo 0.1 caía
 * justo ahí: la miniatura salía negra y parecía rota. Medido en videos reales
 * del usuario: brillo 0 en el instante 0.1.
 *
 * Se prueba pronto y se va hacia dentro del video. La proporción de la duración
 * está al final para que un video largo no se quede atascado en su cabecera.
 */
const INSTANTES: ReadonlyArray<number | "un décimo"> = [0.1, 1, 3, "un décimo"];

/**
 * Diferencia de luz mínima para dar un fotograma por bueno, sobre 255.
 *
 * NO ES UN NÚMERO ELEGIDO A OJO. Sale de medir los casos que hay que separar,
 * en fotogramas reales reducidos al tamaño de la miniatura:
 *
 *   fade-in a 0.1s, inservible ...........  12   ← hay que rechazarlo
 *   negro entero .........................   0   ← hay que rechazarlo
 *   el mismo fade-in un segundo después ..  125   ← hay que aceptarlo
 *   escena legítimamente oscura .......... 137   ← hay que aceptarlo
 *   video normal ......................... 242
 *
 * Es un SUELO, no un objetivo: por encima de él un fotograma puede seguir
 * siendo pésimo. Ver `CONTRASTE_BUENO`.
 *
 * 40 cae en mitad del hueco, con margen ancho por los dos lados. Un umbral
 * pequeño —8 -- daba por bueno el fade-in: técnicamente varía, pero es negro a
 * la vista, y una miniatura negra no dice nada.
 *
 * SE MIDE EL CONTRASTE, NO EL BRILLO. Rechazar por oscuro tiraría la escena
 * nocturna, que es un fotograma perfectamente válido; lo que no sirve es lo que
 * no tiene relieve.
 */
const MINIMO_CONTRASTE = 40;

/**
 * Contraste a partir del cual un fotograma es BUENO y se deja de buscar.
 *
 * QUEDARSE CON EL PRIMERO QUE PASABA EL SUELO ERA EL DEFECTO. Una grabación de
 * pantalla de una interfaz oscura daba 42 en el instante 0.1 —dos puntos por
 * encima del suelo, y a la vista un rectángulo negro— mientras que un segundo
 * más tarde daba 228. El fotograma existía, se pintaba y el usuario seguía
 * viendo negro, porque «pasa el mínimo» no es lo mismo que «se ve».
 *
 * Con este segundo listón, el suelo recupera su papel de último recurso: se
 * sigue buscando mientras lo que hay solo lo supere por poco, y se guarda lo
 * mejor visto por si ninguno llega a bueno.
 *
 * 120 sale de los mismos fotogramas medidos: separa lo que se ve —125 el
 * fade-in ya resuelto, 137 una escena nocturna, 228 la grabación de pantalla en
 * su buen instante, 242 un video normal— de lo que no —42 esa misma grabación
 * en su mal instante, 13 un fundido, 0 el negro—.
 *
 * NO ENCARECE EL CASO NORMAL: un video corriente pasa de 120 en el primer
 * instante y se resuelve con un solo salto, igual que antes.
 */
const CONTRASTE_BUENO = 120;

/** Fotogramas ya obtenidos, por fuente. */
const cache = new Map<string, string>();

/** Fuentes que ya se están resolviendo, para no capturar dos veces la misma. */
const enCurso = new Set<string>();

/** Fuentes que fallaron: no se reintenta en bucle. */
const fallidas = new Set<string>();

/**
 * Fuentes que se olvidaron MIENTRAS se capturaban.
 *
 * Una captura tarda cerca de un segundo y no se puede cancelar a mitad, así que
 * el usuario tiene tiempo de sobra para cambiar de archivo antes de que
 * termine. Cuando eso pasa, el fotograma que llega es de un video que ya no
 * está en ningún bloque y cuyo Object URL ya se revocó: guardarlo dejaría en la
 * caché una entrada muerta que nadie va a leer ni a limpiar nunca.
 *
 * No puede llegar a enseñarse el video equivocado —cada archivo tiene su propio
 * Object URL y la caché va por esa clave—, pero sí acumularse. Esto es lo que
 * hace que el resultado tardío se tire en vez de guardarse.
 */
const abandonadas = new Set<string>();

/** Quien quiera enterarse de que ha llegado un fotograma nuevo. */
const suscriptores = new Set<() => void>();

function avisar(): void {
  for (const suscriptor of suscriptores) suscriptor();
}

/**
 * Avisa cuando aparece una miniatura nueva.
 *
 * Lo necesita React: la captura termina después del render que la pidió, y sin
 * este aviso el fotograma se quedaría en la caché sin que nadie volviera a
 * preguntar por él.
 */
export function alLlegarMiniatura(suscriptor: () => void): () => void {
  suscriptores.add(suscriptor);
  return () => void suscriptores.delete(suscriptor);
}

/**
 * Traduce un instante de la lista al segundo concreto de ESTE video.
 *
 * `null` significa que ese instante no existe aquí —cae más allá del final—,
 * así que se salta: pedirlo devolvería el último fotograma, y en un video que
 * termina en negro eso reproduce el mismo defecto por el otro extremo.
 */
function instanteReal(cuando: number | "un décimo", duracion: number): number | null {
  if (!Number.isFinite(duracion) || duracion <= 0) {
    return typeof cuando === "number" ? cuando : null;
  }

  const segundo = cuando === "un décimo" ? duracion / 10 : cuando;

  return segundo < duracion ? segundo : null;
}

/**
 * Cuánto VARÍA lo dibujado, de 0 a 255.
 *
 * QUÉ SE PREGUNTA: no «¿es oscuro?», sino «¿VARÍA?». Un fotograma legítimo
 * puede ser una escena nocturna casi negra, y descartarlo por oscuro sería
 * equivocarse; lo que no informa de nada es un rectángulo de un solo color,
 * venga de un fundido, de una claqueta o de una grabación que no capturó nada.
 *
 * Se mira un pixel de cada cien: sobra para distinguir «liso» de «con imagen» y
 * evita recorrer miles en cada intento.
 */
function contrasteDe(pincel: CanvasRenderingContext2D, lienzo: HTMLCanvasElement): number {
  // Puede lanzar si el canvas quedó contaminado por CORS. Lo recoge quien llama.
  const { data } = pincel.getImageData(0, 0, lienzo.width, lienzo.height);

  let minimo = 255;
  let maximo = 0;

  for (let i = 0; i < data.length; i += 400) {
    const luz = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (luz < minimo) minimo = luz;
    if (luz > maximo) maximo = luz;
  }

  return maximo - minimo;
}

/**
 * Saca un fotograma de un video sin montarlo en la página.
 *
 * El elemento vive lo que dura la captura y se desmonta pase lo que pase. No
 * lleva controles, no suena y no se reproduce: solo se le pide que decodifique
 * un instante.
 */
async function capturarFotograma(src: string): Promise<string | null> {
  if (typeof document === "undefined") return null;

  const video = document.createElement("video");
  // `auto`, NO `metadata`. Aquí no se enseña una barra de duración: se copia un
  // fotograma, y para eso hacen falta píxeles decodificados.
  //
  // `metadata` significa «tráeme la ficha técnica y para», y WebKit lo cumple
  // literalmente: llega a `loadedmetadata` con readyState 1, emite `suspend` y
  // no carga un solo fotograma más, así que el `loadeddata` que se espera abajo
  // no llega nunca y la captura muere en su tope de tiempo. Medido en WebKit:
  // `loadedmetadata @130ms rs=1`, `suspend @130ms`, y a los 5s seguía sin datos.
  //
  // Chrome carga de más por su cuenta y alcanzaba readyState 4 igualmente: por
  // eso esto funcionaba en Chrome por accidente, pidiendo una cosa y contando
  // con otra. Se pide lo que de verdad se necesita.
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;

  // TIENE QUE ESTAR EN LA PÁGINA PARA QUE HAYA FOTOGRAMA QUE COPIAR.
  //
  // Chrome decodifica un elemento suelto, creado y nunca insertado, y por eso
  // esto funcionaba sin darse cuenta de que dependía de ello. WebKit no: a un
  // `<video>` fuera del documento no le dedica decodificación, así que
  // `drawImage` copia un lienzo vacío y todos los instantes salen sin
  // contraste. El resultado es el icono en el nodo y ningún poster en el
  // editor — un cuadro negro.
  //
  // Se aparta de la vista MOVIÉNDOLO, no escondiéndolo: `display: none` y
  // `visibility: hidden` reproducen el mismo problema, porque un elemento que
  // no se pinta tampoco tiene fotograma que ceder. Ocupa dos píxeles fuera de
  // la pantalla, no recibe eventos y se retira pase lo que pase.
  video.setAttribute("aria-hidden", "true");
  video.style.cssText =
    "position:fixed;left:-10000px;top:0;width:2px;height:2px;opacity:0;pointer-events:none";
  document.body.appendChild(video);
  // Sin esto, un video de otro dominio contamina el canvas y `toDataURL`
  // lanza. Con esto, el servidor decide: si no da permiso, la carga falla y se
  // cae al icono — que es exactamente lo que debe pasar.
  if (!src.startsWith("blob:")) video.crossOrigin = "anonymous";

  try {
    // PRIMERA ESPERA: hasta que haya una imagen decodificada, no solo la ficha
    // técnica. Es la diferencia entre `loadedmetadata` y `loadeddata`, y no es
    // un matiz: con solo metadatos el elemento conoce duración y tamaño pero no
    // tiene ningún fotograma dentro, el salto de abajo no llega a completarse y
    // el canvas copia un rectángulo negro. Medido: negro puro, brillo 0.
    await new Promise<void>((resolve, reject) => {
      const fin = setTimeout(() => reject(new Error("tope")), TOPE_MS);
      const ok = () => { clearTimeout(fin); resolve(); };
      const mal = () => { clearTimeout(fin); reject(new Error("carga")); };

      video.onloadeddata = ok;
      video.onerror = mal;
      video.src = src;
    });

    const ancho = video.videoWidth;
    const alto = video.videoHeight;
    if (!ancho || !alto) return null;

    const lienzo = document.createElement("canvas");
    lienzo.width = Math.min(ANCHO_MINIATURA, ancho);
    lienzo.height = Math.round((lienzo.width / ancho) * alto);

    const pincel = lienzo.getContext("2d");
    if (!pincel) return null;

    // SEGUNDA ESPERA, UNA POR INSTANTE: se salta, se copia y se mide.
    //
    // SE BUSCA EL MEJOR, NO EL PRIMERO QUE APRUEBE. Con «el primero que pase el
    // suelo» bastaba un 42 sobre 40 para quedarse con un fotograma que a la
    // vista es negro, aunque un segundo después hubiera un 228. En cuanto uno
    // es claramente bueno se para, así que un video corriente sigue costando un
    // solo salto.
    let mejor: string | null = null;
    let mejorContraste = 0;

    for (const cuando of INSTANTES) {
      const instante = instanteReal(cuando, video.duration);
      if (instante === null) continue;

      await new Promise<void>((resolve) => {
        // Si el salto no ocurre —duración desconocida, formato raro—, se sigue
        // con el fotograma que haya: mejor uno imperfecto que ninguno.
        const fin = setTimeout(resolve, TOPE_MS / 4);
        video.onseeked = () => { clearTimeout(fin); resolve(); };
        video.currentTime = instante;
      });

      pincel.drawImage(video, 0, 0, lienzo.width, lienzo.height);
      // Lanza si el canvas quedó contaminado por CORS: se convierte en `null`.
      const contraste = contrasteDe(pincel, lienzo);
      if (contraste <= mejorContraste) continue;

      mejorContraste = contraste;
      mejor = lienzo.toDataURL("image/jpeg", 0.6);
      if (contraste >= CONTRASTE_BUENO) return mejor;
    }

    // Ninguno llegó a bueno. Se acepta el mejor visto si al menos enseña algo;
    // si ni eso, no hay fotograma: un rectángulo liso no informa de nada y
    // además parece un fallo del producto, mientras que el icono dice «esto es
    // un video», que es verdad y es más útil.
    return mejorContraste > MINIMO_CONTRASTE ? mejor : null;
  } catch {
    return null;
  } finally {
    video.onloadeddata = null;
    video.onerror = null;
    video.onseeked = null;
    video.removeAttribute("src");
    video.load();
    // Se retira de la página en el mismo sitio donde se soltaba el archivo: el
    // elemento vive lo que dura la captura y ni un render más.
    video.remove();
  }
}

/**
 * Lo mismo, PERO SIN PONER NADA EN MARCHA.
 *
 * Existe para poder responder a React desde `useSyncExternalStore`, que exige
 * una lectura pura: la llama cuando quiere y varias veces seguidas, y una
 * lectura que arranca trabajo ahí dentro sería un efecto escondido en mitad del
 * render. Quien use esto arranca la captura por su lado, desde un efecto.
 *
 * Devuelve siempre el MISMO valor mientras nada cambie —o la cadena cacheada, o
 * `null`—, que es la otra condición que React pone para no repintar en bucle.
 */
export function miniaturaYaObtenida(src: string, esVideo: boolean): string | null {
  if (!src) return null;
  if (!esVideo) return src;

  return cache.get(src) ?? null;
}

/**
 * Empieza a sacar el fotograma ANTES de que nadie lo pinte.
 *
 * Sin esto, el trabajo arrancaba en el primer render del nodo cerrado, que
 * ocurre al guardar: el usuario cerraba el editor y se quedaba mirando el icono
 * casi un segundo mientras el video se decodificaba. Los bytes, sin embargo,
 * están disponibles desde mucho antes —desde que se eligió el archivo—, así que
 * la espera se gasta mientras el editor sigue abierto y el nodo aparece ya con
 * su fotograma.
 *
 * Es solo un adelanto, nunca un requisito: quien no lo llame obtiene el mismo
 * resultado, más tarde. Y llamarlo dos veces no cuesta nada.
 */
export function precalentarMiniatura(src: string): void {
  if (!src || cache.has(src) || enCurso.has(src) || fallidas.has(src)) return;

  enCurso.add(src);
  void capturarFotograma(src).then((fotograma) => {
    enCurso.delete(src);

    // Llegó tarde: mientras se capturaba, esta fuente dejó de existir. Ni se
    // guarda ni se avisa a nadie — no hay nadie a quien avisar.
    if (abandonadas.delete(src)) return;

    if (fotograma) {
      cache.set(src, fotograma);
      avisar();
      return;
    }

    // Se recuerda el fallo para no repetir el intento en cada render. Deja de
    // recordarse en cuanto la fuente cambia: `olvidarMiniatura` lo limpia.
    fallidas.add(src);
  });
}

/**
 * Olvida todo lo asociado a una fuente que deja de existir.
 *
 * Lo llama la sesión al soltar un archivo —reemplazarlo, quitarlo, borrar el
 * bloque—: su Object URL se revoca y el fotograma que salió de él ya no
 * representa nada.
 */
export function olvidarMiniatura(src: string): void {
  cache.delete(src);
  fallidas.delete(src);

  // Si había una captura viva, se marca para que tire lo que traiga. Borrarla
  // solo de `enCurso` no bastaba: la promesa sigue su curso igualmente y
  // volvería a meter en la caché el fotograma de algo que ya no existe.
  if (enCurso.delete(src)) abandonadas.add(src);
}

// ---------------------------------------------------------------------------
// LO QUE CADUCA CUANDO UN ARCHIVO DEJA LA SESIÓN.
//
// Un fotograma sacado de un Object URL deja de representar nada en cuanto ese
// enlace se revoca —al reemplazar el archivo, al quitarlo o al borrar el
// bloque—. Alguien tiene que olvidarlo, y ese alguien es este módulo: es quien
// lo guardó.
//
// LA DIRECCIÓN IMPORTA. Antes lo hacía la sesión, llamando aquí: el registro de
// archivos tenía que saber que existen las miniaturas, y habría tenido que
// aprenderse cada consumidor nuevo. Ahora la sesión solo anuncia que cambió y
// publica lo que tiene; quien derivó algo de ello se ocupa de su parte.
//
// SOLO SE OLVIDA LO QUE VINO DE LA SESIÓN. La caché también guarda fotogramas
// de enlaces remotos, que no están aquí y no caducan con ella; por eso se
// compara contra lo que la sesión tenía la última vez, y no contra todo lo
// cacheado.
// ---------------------------------------------------------------------------

let deLaSesion: ReadonlySet<string> = new Set();

alCambiarLaSesion(() => {
  const ahora = new Set(fuentesDeSesion().map(({ enlace }) => enlace));

  for (const enlace of deLaSesion) {
    if (!ahora.has(enlace)) olvidarMiniatura(enlace);
  }

  deLaSesion = ahora;
});
