import { useRef, useState } from "react";
import { acceptAttribute } from "@contracts/MediaContracts";
import type { MessageMediaKind } from "../types";
import { attachFile, releaseFile } from "../mediaSourceSession";
import { useSessionObjectUrl } from "../usePreview";
import { getItemIcon } from "./itemIcons";
import { MediaFilePreview } from "./MediaFilePreview";
import { useMediaUpload } from "./MediaUploadContext";

/** Lo que baja al bloque al elegir, subir o quitar un archivo. */
export interface FileSourceChange {
  readonly fileName: string;
  readonly url: string;
  readonly mediaId: string;
}

interface FileSourceProps {
  readonly kind: MessageMediaKind;
  readonly position: number;
  /** Id del bloque: localiza su vista previa en la sesión. */
  readonly itemId: string;
  readonly savedFileName: string;
  readonly savedUrl: string;
  readonly mediaId: string;
  readonly onPick: (change: FileSourceChange) => void;
}

const BROWSE_LABEL: Readonly<Record<MessageMediaKind, string>> = {
  image: "Seleccionar imagen",
  video: "Seleccionar video",
  audio: "Seleccionar audio",
  file: "Seleccionar archivo"
};

type Upload = { readonly state: "idle" } | { readonly state: "uploading"; readonly name: string; readonly progress: number };

const EMPTY: FileSourceChange = { fileName: "", url: "", mediaId: "" };

/**
 * Zona para traer un archivo del dispositivo (diálogo o arrastrar; soltar otro
 * encima lo reemplaza). El archivo se SUBE al almacén de la cuenta en cuanto
 * se elige; al bloque baja su URL pública, su nombre y su registro. Mientras
 * sube se ve la vista previa local con el progreso.
 *
 * Una sola caja con el mismo alto en todos sus estados, para no empujar lo
 * que va debajo.
 */
export function FileSource({ kind, position, itemId, savedFileName, savedUrl, mediaId, onPick }: FileSourceProps) {
  const [receiving, setReceiving] = useState(false);
  const [upload, setUpload] = useState<Upload>({ state: "idle" });
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = getItemIcon(kind);
  const objectUrl = useSessionObjectUrl(itemId);
  const uploadMedia = useMediaUpload();
  const uploaded = Boolean(mediaId && savedUrl);

  const choose = async (file: File | null) => {
    setError(null);
    if (!file) {
      releaseFile(itemId);
      onPick(EMPTY);
      return;
    }

    attachFile(itemId, file);
    if (!uploadMedia) {
      setError("Para guardar archivos, abre el flujo con conexión.");
      onPick({ fileName: file.name, url: "", mediaId: "" });
      return;
    }

    setUpload({ state: "uploading", name: file.name, progress: 0 });
    const outcome = await uploadMedia(file, kind, (progress) => setUpload({ state: "uploading", name: file.name, progress }));
    setUpload({ state: "idle" });
    if (outcome.ok) {
      onPick({ fileName: outcome.value.fileName, url: outcome.value.url, mediaId: outcome.value.id });
      return;
    }
    releaseFile(itemId);
    setError(outcome.message);
    onPick(EMPTY);
  };

  const openPicker = () => inputRef.current?.click();
  const busy = upload.state === "uploading";

  return (
    <>
      <div
        className={`media-file${receiving ? " media-file--receiving" : ""}`}
        onDragOver={(event) => {
          // El constructor también escucha `drop` para colocar bloques.
          event.preventDefault();
          event.stopPropagation();
          if (!busy) setReceiving(true);
        }}
        onDragLeave={() => setReceiving(false)}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setReceiving(false);
          if (!busy) void choose(event.dataTransfer.files?.[0] ?? null);
        }}
      >
        {busy ? (
          <MediaFilePreview
            kind={kind}
            src={objectUrl ?? ""}
            name={upload.name}
            size={`Subiendo… ${upload.progress}%`}
            progress={upload.progress}
            onChange={openPicker}
            onRemove={() => void choose(null)}
          />
        ) : uploaded ? (
          <MediaFilePreview
            kind={kind}
            src={objectUrl ?? savedUrl}
            name={savedFileName}
            size="Guardado"
            onChange={openPicker}
            onRemove={() => void choose(null)}
          />
        ) : savedFileName && objectUrl ? (
          // Elegido en esta sesión pero sin subir (sin conexión al almacén):
          // se ve, pero todavía no está guardado.
          <MediaFilePreview
            kind={kind}
            src={objectUrl}
            name={savedFileName}
            size="Sin guardar"
            onChange={openPicker}
            onRemove={() => void choose(null)}
          />
        ) : savedFileName ? (
          // Archivo elegido antes de que existiera la subida (o subida que no
          // terminó): consta el nombre pero no hay bytes guardados.
          <MediaFilePreview
            kind={kind}
            src=""
            name={savedFileName}
            size="No se guardó: vuelve a elegir el archivo"
            onChange={openPicker}
            onRemove={() => void choose(null)}
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

        {/* Un único input para elegir y para «Cambiar». Solo formatos que WhatsApp entrega. */}
        <input
          ref={inputRef}
          type="file"
          className="media-file__input"
          accept={acceptAttribute(kind)}
          disabled={busy}
          onChange={(event) => {
            void choose(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
          aria-label={`${BROWSE_LABEL[kind]} del bloque ${position}`}
        />
      </div>
      {error ? (
        <p className="media-file__error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
