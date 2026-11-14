import type { MessageMediaKind } from "../types";
import { hasMediaVariable, isMediaSource, isUsableUrl } from "../mediaSource";

interface UrlSourceProps {
  readonly kind: MessageMediaKind;
  readonly position: number;
  readonly url: string;
  readonly onChange: (url: string) => void;
}

/** Mientras se escribe, vacío es válido; qué enlace sirve lo decide `mediaSource` (un enlace o una variable). */
function isAcceptable(url: string): boolean {
  const trimmed = url.trim();
  return trimmed.length === 0 || isMediaSource(trimmed);
}

/** Última parte del enlace: lo que el usuario reconoce como «el archivo». */
function fileNameFromUrl(url: string): string {
  const path = url.split(/[?#]/)[0];
  const last = path.slice(path.lastIndexOf("/") + 1);
  return last.length > 0 ? decodeURIComponent(last) : url;
}

/**
 * Enlace a un archivo ya publicado, o una variable que lo trae al enviar
 * (`{portada}`, `{kie.ai.result}`), como en Leona: así se envía lo que acaba
 * de crear una Integración. Es un dato real que se guarda en el bloque.
 */
export function UrlSource({ kind, position, url, onChange }: UrlSourceProps) {
  const acceptable = isAcceptable(url);
  const variable = hasMediaVariable(url);
  const hasUrl = url.trim().length > 0 && isUsableUrl(url.trim()) && !variable;

  return (
    <div className="media-url">
      <label className="media-url__field">
        <span className="media-url__label">URL del archivo o variable</span>
        <input
          type="text"
          inputMode="url"
          spellCheck={false}
          className={`media-url__input nodrag${acceptable ? "" : " media-url__input--invalid"}`}
          value={url}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://… o {portada}"
          aria-label={`URL del archivo del bloque ${position}`}
          aria-invalid={!acceptable}
        />
      </label>

      {acceptable ? null : <p className="media-url__error">Debe empezar por http:// o https://, o ser una variable como {"{portada}"}</p>}
      {variable && acceptable ? <p className="media-url__hint">Se envía el enlace que tenga esta variable en ese momento (por ejemplo, el que guardó una Integración). Si está vacía, este archivo no sale.</p> : null}

      {hasUrl ? (
        <div className="media-url__preview">
          {kind === "image" ? <img className="media-url__thumb" src={url} alt="" /> : null}
          <span className="media-url__name">{fileNameFromUrl(url)}</span>
        </div>
      ) : null}
    </div>
  );
}
