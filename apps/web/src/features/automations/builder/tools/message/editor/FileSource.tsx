import { useRef, useState } from "react";
import type { MessageMediaKind } from "../types";
import { adjuntarArchivo, enlaceDeSesion, soltarArchivo } from "../mediaSourceSession";
import { getItemIcon } from "./itemIcons";
import { MediaFilePreview } from "./MediaFilePreview";

interface FileSourceProps {
  readonly kind: MessageMediaKind;
  readonly position: number;
  /** Identidad del bloque: con ella se localiza su archivo en la sesión. */
  readonly itemId: string;
  /**
   * Nombre del archivo que el bloque tiene guardado.
   *
   * Es la parte SERIALIZABLE de la fuente: sobrevive a cerrar, reabrir y
   * recargar. Los bytes no; esos se buscan aparte, en la sesión.
   */
  readonly nombreGuardado: string;
  /** Avisa del nombre elegido —o de que ya no hay— para que baje al bloque. */
  readonly onPick: (fileName: string) => void;
}

const ACCION: Readonly<Record<MessageMediaKind, string>> = {
  image: "Seleccionar imagen",
  video: "Seleccionar video",
  audio: "Seleccionar audio",
  file: "Seleccionar archivo"
};

/** Tipos que ofrece el diálogo del sistema. `file` no restringe nada. */
const ACEPTA: Readonly<Record<MessageMediaKind, string>> = {
  image: "image/*",
  video: "video/*",
  audio: "audio/*",
  file: ""
};

/**
 * Zona para traer el archivo desde el dispositivo.
 *
 * UNA SOLA CAJA, DOS CONTENIDOS. El contenedor `.media-file` es el mismo
 * elemento esté vacío o con archivo: mismo alto, mismo borde, mismo radio,
 * mismo padding. Antes había dos ramas que devolvían árboles distintos —una
 * zona grande y una ficha compacta de la mitad de alto—, así que elegir un
 * archivo encogía la zona ~58px y empujaba hacia arriba la descripción y el
 * interruptor que van debajo. Ahora lo único que cambia es lo que va dentro, y
 * el alto lo garantiza el CSS en un único sitio (`--media-area-height`).
 *
 * FRONTERA CON EL FUTURO ADAPTADOR. Se separan dos cosas que antes iban juntas
 * y no debían:
 *
 *   los BYTES  viven aquí, en `file`, y no sobreviven a recargar — no hay dónde
 *              subirlos todavía (`infrastructure/storage` está vacío)
 *   la ELECCIÓN sí baja al bloque, como `fileName`. Es información del mensaje:
 *              el usuario eligió un archivo, y eso no puede depender de que un
 *              componente siga montado
 *
 * Confundirlas costaba un defecto real: la validación no veía la elección y
 * pedía un enlace a quien ya había adjuntado su foto.
 *
 * El día que exista almacenamiento, este es el único punto que cambia: aquí se
 * llamará al adaptador y el enlace que devuelva se escribirá en `url`. La regla
 * de validación —archivo O enlace— no se toca.
 *
 * El Object URL del preview no se guarda: solo vale dentro de esta pestaña.
 *
 * Dos formas de traerlo, las dos reales hoy: el diálogo del sistema y arrastrar
 * desde el escritorio. Las dos siguen funcionando con un archivo ya elegido:
 * soltar otro encima lo reemplaza.
 */
export function FileSource({
  kind,
  position,
  itemId,
  nombreGuardado,
  onPick
}: FileSourceProps) {
  const [recibiendo, setRecibiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = getItemIcon(kind);

  // Los bytes NO viven aquí. Se consultan en la sesión, que los conserva
  // mientras la pestaña siga abierta —también con este componente desmontado,
  // que es justo lo que antes fallaba—.
  const enlaceLocal = enlaceDeSesion(itemId);

  /** Adjunta —o suelta— el archivo, y avisa para que el nombre baje al bloque. */
  const elegir = (file: File | null) => {
    if (!file) {
      soltarArchivo(itemId);
      onPick("");
      return;
    }

    adjuntarArchivo(itemId, file);
    onPick(file.name);
  };

  const abrirSelector = () => inputRef.current?.click();

  return (
    <div
      className={`media-file${recibiendo ? " media-file--receiving" : ""}`}
      onDragOver={(event) => {
        // El constructor también escucha `drop` para colocar bloques. Aquí se
        // corta: soltar un archivo del escritorio no debe crear un bloque.
        event.preventDefault();
        event.stopPropagation();
        setRecibiendo(true);
      }}
      onDragLeave={() => setRecibiendo(false)}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setRecibiendo(false);
        elegir(event.dataTransfer.files?.[0] ?? null);
      }}
    >
      {nombreGuardado && enlaceLocal ? (
        // Los bytes siguen en la sesión: se ve el archivo de verdad.
        <MediaFilePreview
          kind={kind}
          src={enlaceLocal}
          name={nombreGuardado}
          size=""
          onChange={abrirSelector}
          onRemove={() => elegir(null)}
        />
      ) : nombreGuardado ? (
        // Consta la elección pero los bytes ya no están —se recargó la página—.
        // Se enseña sin `src`: no se inventa una vista previa que no existe, ni
        // se finge que la zona esté vacía.
        <MediaFilePreview
          kind={kind}
          src=""
          name={nombreGuardado}
          size="Se volverá a adjuntar al publicar"
          onChange={abrirSelector}
          onRemove={() => elegir(null)}
        />
      ) : (
        <>
          <span className="media-file__icon" aria-hidden="true">
            <Icon />
          </span>

          {/* UN SOLO RENGLÓN DE TEXTO, NO DOS.
              Había un título que decía exactamente lo mismo que el botón de
              abajo —«Seleccionar imagen» repetido a dos centímetros de
              distancia—, así que se retira: no aportaba información, solo alto.

              Lo que NO se puede perder es el aviso de que la zona está
              recibiendo un archivo, y ese vive ahora aquí. Se cambia el mensaje
              de esta línea en vez de añadir otra: una línea de más aparecería
              en mitad del gesto de arrastre y desplazaría la zona justo debajo
              del puntero. */}
          <span className="media-file__hint">
            {recibiendo ? "Suelta aquí" : "Arrastra el archivo o búscalo en tu dispositivo"}
          </span>

          <button type="button" className="media-file__browse nodrag" onClick={abrirSelector}>
            {ACCION[kind]}
          </button>
        </>
      )}

      {/* UNO SOLO, fuera de las dos ramas. «Cambiar» reabre este mismo
          selector: no hay un segundo sistema de selección para el archivo ya
          elegido, que es lo que ocurría cuando cada rama traía su propio
          input. */}
      <input
        ref={inputRef}
        type="file"
        className="media-file__input"
        accept={ACEPTA[kind] || undefined}
        onChange={(event) => elegir(event.target.files?.[0] ?? null)}
        aria-label={`${ACCION[kind]} del bloque ${position}`}
      />
    </div>
  );
}
