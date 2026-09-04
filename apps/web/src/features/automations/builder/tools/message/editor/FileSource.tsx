import { useRef, useState } from "react";
import type { MessageMediaKind } from "../types";
import { getItemIcon } from "./itemIcons";

interface FileSourceProps {
  readonly kind: MessageMediaKind;
  readonly position: number;
  /** Archivo elegido, si lo hay. Vive en el editor, no en la configuración. */
  readonly file: File | null;
  readonly onPick: (file: File | null) => void;
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

function tamaño(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Zona para traer el archivo desde el dispositivo.
 *
 * FRONTERA CON EL FUTURO ADAPTADOR: el `File` elegido vive SOLO en el estado
 * local del editor y no llega a la configuración del nodo. No hay dónde
 * guardarlo —`infrastructure/storage` está vacío— y escribir su nombre en el
 * mensaje daría a entender que el archivo está subido cuando no lo está. El día
 * que exista almacenamiento, este es el único punto que cambia: aquí se llamará
 * al adaptador y lo que devuelva se escribirá en el bloque.
 *
 * Dos formas de traerlo, las dos reales hoy: el diálogo del sistema y arrastrar
 * desde el escritorio.
 */
export function FileSource({ kind, position, file, onPick }: FileSourceProps) {
  const [recibiendo, setRecibiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = getItemIcon(kind);

  if (file) {
    return (
      <div className="media-file media-file--picked">
        <span className="media-file__badge" aria-hidden="true">
          <Icon />
        </span>
        <span className="media-file__meta">
          <span className="media-file__name">{file.name}</span>
          <span className="media-file__size">{tamaño(file.size)}</span>
        </span>
        <span className="media-file__controls">
          <button
            type="button"
            className="media-file__control nodrag"
            onClick={() => inputRef.current?.click()}
          >
            Cambiar
          </button>
          <button
            type="button"
            className="media-file__control media-file__control--clear nodrag"
            onClick={() => onPick(null)}
          >
            Quitar
          </button>
        </span>

        <input
          ref={inputRef}
          type="file"
          className="media-file__input"
          accept={ACEPTA[kind] || undefined}
          onChange={(event) => onPick(event.target.files?.[0] ?? null)}
          aria-label={`${ACCION[kind]} del bloque ${position}`}
        />
      </div>
    );
  }

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
        onPick(event.dataTransfer.files?.[0] ?? null);
      }}
    >
      <span className="media-file__icon" aria-hidden="true">
        <Icon />
      </span>

      {/* UN SOLO RENGLÓN DE TEXTO, NO DOS.
          Había un título que decía exactamente lo mismo que el botón de abajo
          —«Seleccionar imagen» repetido a dos centímetros de distancia—, así
          que se retira: no aportaba información, solo alto.

          Lo que NO se puede perder es el aviso de que la zona está recibiendo
          un archivo, y ese vive ahora aquí. Se cambia el mensaje de esta línea
          en vez de añadir otra: una línea de más aparecería en mitad del gesto
          de arrastre y desplazaría la zona justo debajo del puntero. */}
      <span className="media-file__hint">
        {recibiendo ? "Suelta aquí" : "Arrastra el archivo o búscalo en tu dispositivo"}
      </span>

      <button
        type="button"
        className="media-file__browse nodrag"
        onClick={() => inputRef.current?.click()}
      >
        {ACCION[kind]}
      </button>

      <input
        ref={inputRef}
        type="file"
        className="media-file__input"
        accept={ACEPTA[kind] || undefined}
        onChange={(event) => onPick(event.target.files?.[0] ?? null)}
        aria-label={`${ACCION[kind]} del bloque ${position}`}
      />
    </div>
  );
}
