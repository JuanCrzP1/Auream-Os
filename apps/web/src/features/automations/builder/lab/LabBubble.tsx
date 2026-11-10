import { useState } from "react";
import type { SimulatedMessage } from "@contracts/SimulationContracts";

const time = (at: Date) => at.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });

/** Doble check de WhatsApp: el mensaje del cliente «llegó». */
function Ticks() {
  return (
    <svg className="lab-bubble__ticks" viewBox="0 0 18 11" aria-hidden="true">
      <path d="M1 6l3 3 6-7M7 9l1 1 6-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Lo que escribió el probador (el cliente): a la derecha, como en WhatsApp. */
export function TesterBubble({ text, at }: { readonly text: string; readonly at: Date }) {
  return (
    <div className="lab-bubble lab-bubble--out">
      <p className="lab-bubble__text">{text}</p>
      <span className="lab-bubble__time">
        {time(at)}
        <Ticks />
      </span>
    </div>
  );
}

function Media({ media, caption }: { readonly media: NonNullable<SimulatedMessage["media"]>; readonly caption: string }) {
  if (media.type === "audio") return <audio className="lab-bubble__audio" controls preload="none" src={media.url} aria-label={media.fileName ?? "Audio"} />;
  if (media.type === "image") return <img className="lab-bubble__image" src={media.url} alt={caption || media.fileName || "Imagen"} loading="lazy" />;
  if (media.type === "video") return <video className="lab-bubble__image" controls preload="metadata" src={media.url} aria-label={media.fileName ?? "Video"} />;
  return (
    <a className="lab-bubble__file" href={media.url} target="_blank" rel="noreferrer">
      <svg className="lab-bubble__file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
        <path d="M14 3v5h5M9 13h6M9 17h4" />
      </svg>
      <span>{media.fileName || "Documento"}</span>
    </a>
  );
}

/**
 * Lo que mandó el flujo: a la izquierda, como un chat de WhatsApp. Debajo, en
 * pequeño, el bloque que lo envió (un toque lo muestra en el lienzo). Los
 * botones de un menú se tocan como lo haría el cliente.
 */
export function FlowBubble({
  message,
  at,
  blockName,
  onFocusBlock,
  onChoose
}: {
  readonly message: SimulatedMessage;
  readonly at: Date;
  readonly blockName: string;
  readonly onFocusBlock: () => void;
  /** Ausente: el menú ya no espera respuesta. */
  readonly onChoose?: (optionId: string, title: string) => void;
}) {
  const [listOpen, setListOpen] = useState(false);
  const menu = message.menu;
  const source = (
    <button type="button" className="lab-bubble__source" onClick={onFocusBlock} title="Ver el bloque en el lienzo">
      {blockName} ›
    </button>
  );

  if (message.kind === "notification") {
    return (
      <div className="lab-system lab-system--notice">
        <strong>Aviso al equipo · {message.recipient?.name}</strong> (+{message.recipient?.phone}): {message.text}
        <span className="lab-system__hint">En pruebas no se envía · {source}</span>
      </div>
    );
  }
  if (message.kind === "reaction") return <p className="lab-system">Reaccionó con {message.text}</p>;

  const options = menu?.options ?? [];
  const showOptions = menu?.format === "buttons" || listOpen;
  return (
    <div className="lab-in">
      <div className={`lab-bubble lab-bubble--in${message.media && !message.text ? " lab-bubble--media" : ""}`}>
        {message.media ? <Media media={message.media} caption={message.text} /> : null}
        {menu?.header ? <p className="lab-bubble__header">{menu.header}</p> : null}
        {message.text ? <p className="lab-bubble__text">{message.text}</p> : null}
        {menu?.footer ? <p className="lab-bubble__footer">{menu.footer}</p> : null}
        <span className="lab-bubble__time">{time(at)}</span>
      </div>
      {menu?.format === "list" ? (
        <button type="button" className="lab-reply" aria-expanded={listOpen} onClick={() => setListOpen((open) => !open)}>
          ☰ {menu.buttonLabel || "Ver opciones"}
        </button>
      ) : null}
      {menu && showOptions ? (
        <div className="lab-replies" role="group" aria-label="Opciones del menú">
          {options.map((option) => (
            <button key={option.id} type="button" className="lab-reply" disabled={!onChoose} onClick={() => onChoose?.(option.id, option.title)} title={option.description}>
              {option.title}
            </button>
          ))}
        </div>
      ) : null}
      <span className="lab-in__source">{source}</span>
    </div>
  );
}
