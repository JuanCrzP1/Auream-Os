import { useRef, useState } from "react";
import type { MessageMediaKind } from "../types";
import { attachFile, releaseFile } from "../mediaSourceSession";
import { useSessionObjectUrl } from "../usePreview";
import { getItemIcon } from "./itemIcons";
import { MediaFilePreview } from "./MediaFilePreview";

interface FileSourceProps {
  readonly kind: MessageMediaKind;
  readonly position: number;
  /** Id del bloque: localiza su archivo en la sesión. */
  readonly itemId: string;
  /** Nombre guardado en el bloque (la parte serializable de la elección). */
  readonly savedFileName: string;
  /** Nombre elegido, o `""` si se quitó, para que baje al bloque. */
  readonly onPick: (fileName: string) => void;
}

const BROWSE_LABEL: Readonly<Record<MessageMediaKind, string>> = {
  image: "Seleccionar imagen",
  video: "Seleccionar video",
  audio: "Seleccionar audio",
  file: "Seleccionar archivo"
};

/** Filtro del diálogo del sistema. `file` no restringe. */
const ACCEPT: Readonly<Record<MessageMediaKind, string>> = {
  image: "image/*",
  video: "video/*",
  audio: "audio/*",
  file: ""
};

/**
 * Zona para traer un archivo del dispositivo (diálogo o arrastrar desde el
 * escritorio; soltar otro encima lo reemplaza).
 *
 * Una sola caja con dos contenidos (vacía o con archivo) y el mismo alto, para
 * no empujar lo que va debajo.
 *
 * Bytes y elección van separados: los bytes viven en la sesión; el NOMBRE baja
 * al bloque para que validación y preview sepan que hay fuente. Fase C: aquí se
 * llamará al adaptador de subida y se escribirá `url`.
 */
export function FileSource({ kind, position, itemId, savedFileName, onPick }: FileSourceProps) {
  const [receiving, setReceiving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = getItemIcon(kind);
  const objectUrl = useSessionObjectUrl(itemId);

  const choose = (file: File | null) => {
    if (!file) {
      releaseFile(itemId);
      onPick("");
      return;
    }

    attachFile(itemId, file);
    onPick(file.name);
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <div
      className={`media-file${receiving ? " media-file--receiving" : ""}`}
      onDragOver={(event) => {
        // El constructor también escucha `drop` para colocar bloques.
        event.preventDefault();
        event.stopPropagation();
        setReceiving(true);
      }}
      onDragLeave={() => setReceiving(false)}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setReceiving(false);
        choose(event.dataTransfer.files?.[0] ?? null);
      }}
    >
      {savedFileName && objectUrl ? (
        <MediaFilePreview
          kind={kind}
          src={objectUrl}
          name={savedFileName}
          size=""
          onChange={openPicker}
          onRemove={() => choose(null)}
        />
      ) : savedFileName ? (
        // Consta la elección pero los bytes ya no están (se recargó): sin vista
        // previa inventada y sin fingir que la zona está vacía.
        <MediaFilePreview
          kind={kind}
          src=""
          name={savedFileName}
          size="Se volverá a adjuntar al publicar"
          onChange={openPicker}
          onRemove={() => choose(null)}
        />
      ) : (
        <>
          <span className="media-file__icon" aria-hidden="true">
            <Icon />
          </span>
          {/* Una línea que cambia durante el arrastre, en vez de añadir otra
              que desplazaría la zona bajo el puntero. */}
          <span className="media-file__hint">
            {receiving ? "Suelta aquí" : "Arrastra el archivo o búscalo en tu dispositivo"}
          </span>
          <button type="button" className="media-file__browse nodrag" onClick={openPicker}>
            {BROWSE_LABEL[kind]}
          </button>
        </>
      )}

      {/* Un único input para elegir y para «Cambiar». */}
      <input
        ref={inputRef}
        type="file"
        className="media-file__input"
        accept={ACCEPT[kind] || undefined}
        onChange={(event) => choose(event.target.files?.[0] ?? null)}
        aria-label={`${BROWSE_LABEL[kind]} del bloque ${position}`}
      />
    </div>
  );
}
