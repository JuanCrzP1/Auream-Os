import type { MessageMediaKind } from "../types";

interface UrlSourceProps {
  readonly kind: MessageMediaKind;
  readonly position: number;
  readonly url: string;
  readonly onChange: (url: string) => void;
}

/** Vacío es un estado válido —todavía no se ha pegado nada—, no un error. */
function esValida(url: string): boolean {
  const limpia = url.trim();
  if (limpia.length === 0) return true;

  try {
    const { protocol } = new URL(limpia);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** Última parte del enlace: lo que el usuario reconoce como «el archivo». */
function nombreDeArchivo(url: string): string {
  const limpio = url.split(/[?#]/)[0];
  const ultimo = limpio.slice(limpio.lastIndexOf("/") + 1);
  return ultimo.length > 0 ? decodeURIComponent(ultimo) : url;
}

/**
 * Enlace a un archivo que ya está publicado en otro sitio.
 *
 * Es la vía que SÍ funciona de extremo a extremo hoy: un enlace es un dato
 * real, se guarda en la configuración del bloque y un adaptador de canal futuro
 * podrá usarlo sin migrar nada. Por eso es la única de las dos que escribe en el
 * mensaje.
 *
 * La validación es deliberadamente mínima —que sea una URL http(s)— porque el
 * motor todavía no comprueba nada más y avisar de reglas que nadie aplica sería
 * inventar rigor.
 */
export function UrlSource({ kind, position, url, onChange }: UrlSourceProps) {
  const valida = esValida(url);
  const tieneEnlace = url.trim().length > 0 && valida;

  return (
    <div className="media-url">
      <label className="media-url__field">
        <span className="media-url__label">URL del archivo</span>
        <input
          type="url"
          className={`media-url__input nodrag${valida ? "" : " media-url__input--invalid"}`}
          value={url}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://"
          aria-label={`URL del archivo del bloque ${position}`}
          aria-invalid={!valida}
        />
      </label>

      {valida ? null : (
        <p className="media-url__error">Debe empezar por http:// o https://</p>
      )}

      {tieneEnlace ? (
        <div className="media-url__preview">
          {kind === "image" ? (
            <img className="media-url__thumb" src={url} alt="" />
          ) : null}
          <span className="media-url__name">{nombreDeArchivo(url)}</span>
        </div>
      ) : null}
    </div>
  );
}
