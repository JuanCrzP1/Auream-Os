import "./image-picker.css";
import { useRef, useState } from "react";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { AccountAvatar } from "@shared/account/AccountAvatar";
import { ACCOUNT_IMAGE_ACCEPT, imageProblem } from "@shared/account/accountApi";

/**
 * Foto de perfil o logo: la imagen actual (o las iniciales), «Cambiar» abre el
 * selector de archivos y sube al momento con su progreso, «Quitar» la borra.
 * Comprueba formato y tamaño antes de subir (el servidor lo vuelve a hacer).
 */
export function ImagePicker({
  name,
  imageUrl,
  shape = "round",
  label,
  disabled = false,
  onUpload,
  onRemove
}: {
  readonly name: string;
  readonly imageUrl: string | null;
  readonly shape?: "round" | "square";
  /** «foto» o «logo»: para los textos. */
  readonly label: string;
  readonly disabled?: boolean;
  readonly onUpload: (file: File, onProgress: (percentage: number) => void) => Promise<void>;
  readonly onRemove: () => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = progress !== null;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const problem = imageProblem(file);
    setError(problem);
    if (problem) return;
    setProgress(0);
    try {
      await onUpload(file, setProgress);
    } catch (e) {
      setError(apiErrorMessage(e, `No se pudo subir la ${label}. Inténtalo de nuevo.`));
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    setError(null);
    setProgress(0);
    try {
      await onRemove();
    } catch (e) {
      setError(apiErrorMessage(e, `No se pudo quitar la ${label}.`));
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="image-picker">
      <span className="image-picker__preview">
        <AccountAvatar name={name || "?"} imageUrl={imageUrl} size={84} shape={shape} />
        {busy ? <span className="image-picker__progress" aria-hidden="true">{progress}%</span> : null}
      </span>
      <div className="image-picker__actions">
        <div className="image-picker__buttons">
          <button type="button" className="ui-btn ui-btn--primary" disabled={disabled || busy} onClick={() => input.current?.click()}>
            {busy ? "Subiendo…" : imageUrl ? `Cambiar ${label}` : `Subir ${label}`}
          </button>
          {imageUrl ? (
            <button type="button" className="ui-btn ui-btn--ghost" disabled={disabled || busy} onClick={() => void remove()}>
              Quitar
            </button>
          ) : null}
        </div>
        <span className="image-picker__hint">JPG, PNG o WebP. Máximo 5 MB.</span>
        {error ? <span className="ui-error" role="alert">{error}</span> : null}
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCOUNT_IMAGE_ACCEPT}
        className="image-picker__input"
        aria-label={`Elegir ${label}`}
        onChange={(event) => void pick(event.target.files?.[0])}
      />
    </div>
  );
}
