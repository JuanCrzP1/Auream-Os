import type { SimulatedMessage } from "@contracts/SimulationContracts";

const MEDIA_LABEL = { image: "Imagen", video: "Video", audio: "Audio", file: "Documento" } as const;

/**
 * Un mensaje que el flujo habría mandado. Lleva el bloque que lo envió (un
 * toque lo muestra en el lienzo). Las opciones de un menú se pueden tocar,
 * como haría el cliente, mientras el menú sea lo último que espera respuesta.
 */
export function LabMessage({
  message,
  blockName,
  onFocusBlock,
  onChoose
}: {
  readonly message: SimulatedMessage;
  readonly blockName: string;
  readonly onFocusBlock: () => void;
  /** Ausente: el menú ya no espera respuesta (las opciones no se tocan). */
  readonly onChoose?: (optionId: string, title: string) => void;
}) {
  const source = (
    <button type="button" className="lab-msg__source" onClick={onFocusBlock} title="Ver el bloque en el lienzo">
      {blockName}
    </button>
  );

  if (message.kind === "notification") {
    return (
      <div className="lab-msg lab-msg--notice">
        <p className="lab-msg__meta">
          Aviso al equipo · {message.recipient?.name} (+{message.recipient?.phone}) · {source}
        </p>
        <p className="lab-msg__text">{message.text}</p>
        <p className="lab-msg__hint">En pruebas no se envía.</p>
      </div>
    );
  }

  if (message.kind === "reaction") {
    return (
      <p className="lab-msg lab-msg--reaction">
        Reacciona con {message.text} · {source}
      </p>
    );
  }

  return (
    <div className="lab-msg lab-msg--flow">
      <p className="lab-msg__meta">{source}</p>
      {message.media ? (
        <a className="lab-msg__media" href={message.media.url} target="_blank" rel="noreferrer">
          {MEDIA_LABEL[message.media.type]}: {message.media.fileName || message.media.url}
        </a>
      ) : null}
      {message.menu?.header ? <p className="lab-msg__header">{message.menu.header}</p> : null}
      {message.text ? <p className="lab-msg__text">{message.text}</p> : null}
      {message.menu?.footer ? <p className="lab-msg__hint">{message.menu.footer}</p> : null}
      {message.menu ? (
        <div className="lab-msg__options" role="group" aria-label={message.menu.buttonLabel ?? "Opciones"}>
          {message.menu.options.map((option) => (
            <button key={option.id} type="button" className="lab-msg__option" disabled={!onChoose} onClick={() => onChoose?.(option.id, option.title)} title={option.description}>
              {option.title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
