import type { MessageMediaKind } from "../types";
import { isUsableUrl } from "../mediaSource";

interface UrlSourceProps {
  readonly kind: MessageMediaKind;
  readonly position: number;
  readonly url: string;
  readonly onChange: (url: string) => void;
}

/** Mientras se escribe, vacío es válido; qué enlace sirve lo decide `mediaSource`. */
function isAcceptable(url: string): boolean {
  const trimmed = url.trim();
  return trimmed.length === 0 || isUsableUrl(trimmed);
}

/** Última parte del enlace: lo que el usuario reconoce como «el archivo». */
function fileNameFromUrl(url: string): string {
  const path = url.split(/[?#]/)[0];
  const last = path.slice(path.lastIndexOf("/") + 1);
  return last.length > 0 ? decodeURIComponent(last) : url;
}

/** Enlace a un archivo ya publicado. Es un dato real que se guarda en el bloque. */
export function UrlSource({ kind, position, url, onChange }: UrlSourceProps) {
  const acceptable = isAcceptable(url);
  const hasUrl = url.trim().length > 0 && acceptable;

  return (
    <div className="media-url">
      <label className="media-url__field">
        <span className="media-url__label">URL del archivo</span>
        <input
          type="url"
          className={`media-url__input nodrag${acceptable ? "" : " media-url__input--invalid"}`}
          value={url}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://"
          aria-label={`URL del archivo del bloque ${position}`}
          aria-invalid={!acceptable}
        />
      </label>

      {acceptable ? null : <p className="media-url__error">Debe empezar por http:// o https://</p>}

      {hasUrl ? (
        <div className="media-url__preview">
          {kind === "image" ? <img className="media-url__thumb" src={url} alt="" /> : null}
          <span className="media-url__name">{fileNameFromUrl(url)}</span>
        </div>
      ) : null}
    </div>
  );
}
