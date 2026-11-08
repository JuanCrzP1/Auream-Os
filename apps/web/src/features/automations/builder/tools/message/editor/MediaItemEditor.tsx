import { useState } from "react";
import type { MessageMediaItem } from "../types";
import { useAutoHeight } from "../../_kit/useAutoHeight";
import { MediaSourceTabs, type MediaSource } from "./MediaSourceTabs";
import { FileSource, type FileSourceChange } from "./FileSource";
import { UrlSource } from "./UrlSource";
import { SendOnceSwitch } from "./SendOnceSwitch";

/** Rótulo y ejemplo de la descripción, contextuales por tipo. */
const CAPTION_COPY: Readonly<Record<MessageMediaItem["kind"], { label: string; placeholder: string }>> = {
  image: { label: "Descripción de la imagen", placeholder: "Describe brevemente esta imagen…" },
  video: { label: "Descripción del video", placeholder: "Describe brevemente este video…" },
  audio: { label: "Descripción del audio", placeholder: "Describe brevemente este audio…" },
  file: { label: "Descripción del archivo", placeholder: "Describe brevemente este archivo…" }
};

interface MediaItemEditorProps {
  readonly item: MessageMediaItem;
  readonly position: number;
  readonly onEdit: (
    change: { url: string } | FileSourceChange | { caption: string } | { sendOnce: boolean }
  ) => void;
}

/**
 * Cuerpo de imagen, video, audio o archivo: pestañas de origen, archivo o
 * enlace, descripción y «enviar una sola vez». Mismo código para los cuatro;
 * cambia el acento (heredado del bloque) y las etiquetas.
 *
 * La pestaña activa es estado de interfaz, no configuración: no va al snapshot.
 * Un archivo se sube al almacén de la cuenta al elegirlo: el bloque guarda su
 * URL, su nombre y su registro.
 */
export function MediaItemEditor({ item, position, onEdit }: MediaItemEditorProps) {
  // Se abre en la pestaña de donde salió el medio: enlace escrito o archivo.
  const [source, setSource] = useState<MediaSource>(item.url && !item.mediaId ? "url" : "file");
  const captionRef = useAutoHeight(item.caption);

  return (
    <div className="message-item__body">
      <MediaSourceTabs active={source} onChange={setSource} position={position} />

      {source === "file" ? (
        <FileSource
          kind={item.kind}
          position={position}
          itemId={item.id}
          savedFileName={item.fileName ?? ""}
          savedUrl={item.url}
          mediaId={item.mediaId ?? ""}
          onPick={(change) => onEdit(change)}
        />
      ) : (
        <UrlSource kind={item.kind} position={position} url={item.url} onChange={(url) => onEdit({ url })} />
      )}

      {/* Textarea, no input: la descripción puede ocupar varios renglones. */}
      <label className="media-caption">
        <span className="media-caption__label">{CAPTION_COPY[item.kind].label}</span>
        <textarea
          ref={captionRef}
          className="media-caption__input nodrag nowheel"
          value={item.caption}
          onChange={(event) => onEdit({ caption: event.target.value })}
          placeholder={CAPTION_COPY[item.kind].placeholder}
          wrap="soft"
        />
      </label>

      <SendOnceSwitch checked={item.sendOnce} onChange={(sendOnce) => onEdit({ sendOnce })} position={position} />
    </div>
  );
}
