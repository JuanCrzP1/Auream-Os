import type { ToolCompactProps } from "../ToolUi";
import type { MessageMediaItem, MessageItem, MessageTextItem } from "./types";
import { MESSAGE_ITEM_LABELS } from "./messageItems";
import { readMessageItems } from "./readMessageConfig";
import { MediaBlockThumbnail } from "./MediaBlockThumbnail";
import { PREVIEW_SIN_CONTENIDO, esBloqueDeContenido } from "./validateMessageContent";
import { getItemIcon } from "./editor/itemIcons";

/** Bloques que el cliente recibe. Una pausa no está entre ellos. */
type BloqueDeContenido = MessageTextItem | MessageMediaItem;

/**
 * `true` si el bloque es algo que se envía, y no tiempo entre dos envíos.
 *
 * La frontera la declara `validateMessageContent`, que es quien decide qué
 * cuenta como contenido para poder guardar. Aquí solo se estrecha el tipo: si
 * mañana esa frontera se mueve, se mueve en un sitio y el preview la sigue.
 */
function esContenido(item: MessageItem): item is BloqueDeContenido {
  return esBloqueDeContenido(item);
}

/**
 * Una línea que describe el bloque.
 *
 * PURA Y SOLO DE PRESENTACIÓN. No decide nada del modelo: lee lo que el bloque
 * ya tiene y elige qué enseñar de ello, en este orden — lo que el usuario
 * escribió primero, y la identidad del tipo cuando no hay nada escrito. Un
 * bloque recién puesto no puede quedarse mudo en el lienzo.
 *
 * Solo acepta contenido: el tipo lo impide, así que no queda una rama muerta
 * describiendo pausas que este componente ya no pinta.
 */
function describir(item: BloqueDeContenido): string {
  if (item.kind === "text") {
    // Los saltos de línea y la sangría del editor no se ven en una sola fila:
    // sin normalizarlos, un texto con enters dejaba huecos raros a mitad de la
    // línea o cortaba antes de tiempo.
    const limpio = item.text.replace(/\s+/g, " ").trim();
    return limpio.length > 0 ? limpio : MESSAGE_ITEM_LABELS.text;
  }

  // UN MEDIO SE IDENTIFICA POR SU TIPO, NO POR SU NOMBRE DE ARCHIVO.
  //
  // Antes ganaba lo que hubiera escrito o adjuntado el usuario, y en una fila
  // de 230px eso era casi siempre un nombre largo recortado a mitad
  // —«Grabación de pantalla 20…»—, que no dice qué lleva el mensaje ni
  // identifica el archivo. El tipo cabe entero y responde a la pregunta que se
  // le hace al nodo cerrado: qué va a recibir esta persona.
  //
  // Lo que el archivo es de verdad ya se ve al lado: la miniatura lo enseña
  // para imagen y video, y el icono oficial para audio y archivo.
  return MESSAGE_ITEM_LABELS[item.kind];
}

/**
 * Lo que enseña el nodo Mensaje CERRADO, en el lienzo.
 *
 * Es la mitad compacta de la herramienta: el mismo `config.items` que edita el
 * nodo abierto, leído en una fila por bloque y en su orden real. Se declara en
 * `ui.tsx` como `CompactBody`, el hueco que el contrato de `ToolUi` ya reservaba
 * para esto, así que `FlowNodeCard` no sabe que existe Mensaje — solo pregunta
 * si la herramienta trae cuerpo propio.
 *
 * ENSEÑA TODO EL CONTENIDO. No hay tope de filas ni recuento de lo que no
 * cabe: el nodo cerrado existe para saber qué lleva el mensaje SIN abrirlo, y
 * esconder bloques detrás de un «+3 más» obliga justo a lo que el preview
 * evita. Un mensaje de quince bloques hace un nodo alto, y eso es información
 * honesta sobre el mensaje, no un defecto: lo que no puede es ensancharse, y
 * de eso se encarga el recorte de cada fila.
 *
 * Lo único que no aparece son las pausas, y no por falta de sitio: no son
 * contenido. Ver el filtro más abajo.
 *
 * SOLO PRESENTACIÓN, y la lista de lo que NO hay es la definición: ni estado,
 * ni manejadores, ni edición, ni arrastre, ni controles, ni reproductor. No
 * escribe en `config.items` porque no tiene con qué: recibe el borrador y
 * devuelve marcado.
 *
 * NO DUPLICA AL EDITOR. La secuencia se lee con `readMessageItems`, el mismo
 * lector defensivo que usan el editor y el resumen —con su compatibilidad
 * hacia atrás incluida—, y los iconos salen de `getItemIcon`, los mismos del
 * constructor. Lo único propio de este archivo es elegir qué texto cabe en una
 * línea, que es justamente lo que el editor no necesita saber.
 */
export function MessageCompactBody({ draft }: ToolCompactProps) {
  const items = readMessageItems(draft.config, draft.content);

  // SOLO CONTENIDO. Un Intervalo no es algo que el cliente reciba: es tiempo
  // entre dos cosas que sí recibe. El nodo cerrado responde a «qué le llega a
  // esta persona», y una pausa no es una respuesta a esa pregunta —lo es a
  // «cómo se construye el envío», que se ve entrando al editor—.
  //
  // Se filtra aquí, al PINTAR, y en ningún sitio más: el bloque sigue en
  // `config.items`, sigue editándose y sigue ejecutándose igual.
  const visibles = items.filter(esContenido);

  // Sin contenido que enviar no hay filas que pintar —tampoco si el mensaje
  // solo tiene pausas, porque entonces no llega nada—. Es un FALLBACK
  // defensivo, no una validación: quien impide guardar esto es el editor, y el
  // rótulo sale del mismo módulo para que las dos vistas digan lo mismo.
  if (visibles.length === 0) {
    return <p className="flow-node__preview">{PREVIEW_SIN_CONTENIDO}</p>;
  }

  return (
    <ul className="flow-node__blocks">
      {visibles.map((item) => {
        const Icon = getItemIcon(item.kind);

        return (
          <li key={item.id} className={`flow-node__block flow-node__block--${item.kind}`}>
            {/* Miniatura o icono: lo decide `MediaBlockThumbnail`, que es quien
                sabe qué fuentes tiene un medio y cómo sacarles una imagen. Aquí
                no se distingue entre tipos de medio. */}
            {item.kind === "text" ? (
              <span className="flow-node__block-badge" aria-hidden="true">
                <Icon />
              </span>
            ) : (
              <MediaBlockThumbnail item={item} Icon={Icon} />
            )}
            <span className="flow-node__block-text">{describir(item)}</span>
          </li>
        );
      })}
    </ul>
  );
}
