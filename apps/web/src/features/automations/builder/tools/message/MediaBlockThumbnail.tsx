import type { ComponentType } from "react";
import type { MessageMediaItem } from "./types";
import { isUsableUrl } from "./mediaSource";
import { usePreview, useSessionObjectUrl } from "./usePreview";

interface MediaBlockThumbnailProps {
  readonly item: MessageMediaItem;
  /** Icono oficial del tipo, si no hay miniatura. */
  readonly Icon: ComponentType;
}

const WITH_THUMBNAIL: ReadonlyArray<MessageMediaItem["kind"]> = ["image", "video"];

/**
 * Miniatura (imagen o fotograma de video) o icono. Siempre un `<img>`: en el
 * lienzo nunca se monta un reproductor. Mientras no hay fotograma, el icono.
 *
 * Fuente: el enlace si es usable; si no, el archivo de la sesión (suscrito,
 * para enterarse cuando el editor adjunta uno).
 */
export function MediaBlockThumbnail({ item, Icon }: MediaBlockThumbnailProps) {
  const isVideo = item.kind === "video";
  const canHaveThumbnail = WITH_THUMBNAIL.includes(item.kind);

  const url = item.url.trim();
  const sessionUrl = useSessionObjectUrl(item.id);
  const source = isUsableUrl(url) ? url : sessionUrl;

  const thumbnail = usePreview(canHaveThumbnail ? source : null, isVideo);

  if (thumbnail) {
    return <img className="flow-node__block-thumb" src={thumbnail} alt="" />;
  }

  return (
    <span className="flow-node__block-badge" aria-hidden="true">
      <Icon />
    </span>
  );
}
