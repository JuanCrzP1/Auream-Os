import "./phone-preview.css";
import type { FlowOption } from "@shared/automations/flowOptions";
import type { BroadcastDraft } from "./broadcastDraft";
import { fillBusinessData } from "@contracts/BusinessDataContracts";
import type { ContactFieldValue } from "@contracts/ContactContracts";
import { useBusinessValues } from "@shared/business-data/useBusinessData";

const FOOTER = "Para no recibir más mensajes, responde SALIR.";

/** El texto como lo verá un cliente: con su nombre (sin nombre, sin hueco) y los Datos del negocio de la cuenta. */
export function previewText(text: string, name: string | null, business: Readonly<Record<string, ContactFieldValue>> = {}): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return fillBusinessData(text, business)
    .replace(/\{(first_name|nombre)(\|[^}]*)?\}/g, first)
    .replace(/\{full_name(\|[^}]*)?\}/g, (name ?? "").trim())
    .replace(/\{[A-Za-z_][\w.-]*(\|[^}]*)?\}/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.!?;:])/g, "$1")
    .trim();
}

/** Cómo lo ve el cliente en su WhatsApp (la primera versión). */
export function PhonePreview({ draft, flows, sampleName }: { readonly draft: BroadcastDraft; readonly flows: ReadonlyArray<FlowOption>; readonly sampleName: string | null }) {
  const name = sampleName ?? "Laura";
  const business = useBusinessValues();
  const message = draft.messages[0];
  const flowName = flows.find((flow) => flow.id === draft.flowIds[0])?.name;
  return (
    <section className="bc-phone" aria-label="Vista previa en WhatsApp">
      <div className="bc-phone__top">
        <span className="bc-phone__avatar" aria-hidden="true" />
        <span>
          <strong>Tu negocio</strong>
          <small>vista previa para {name.split(" ")[0]}</small>
        </span>
      </div>
      <div className="bc-phone__chat">
        {draft.kind === "flow" ? (
          <div className="bc-phone__note">
            {flowName ? `Empieza el flujo «${flowName}» desde su primer bloque, igual que si el cliente escribiera.` : "Elige un flujo para verlo aquí."}
          </div>
        ) : message ? (
          <div className="bc-phone__bubble">
            {message.media ? (
              message.media.type === "image" ? <img className="bc-phone__media" src={message.media.url} alt="" /> : <video className="bc-phone__media" src={message.media.url} muted />
            ) : null}
            {message.text.trim() ? <p>{previewText(message.text, name, business)}</p> : null}
            {draft.settings.optOutFooter ? <p className="bc-phone__footer">{FOOTER}</p> : null}
            <span className="bc-phone__time">10:02 ✓✓</span>
          </div>
        ) : null}
        {draft.kind === "message" && draft.messages.length > 1 ? <span className="bc-phone__more">+ {draft.messages.length - 1} versión{draft.messages.length > 2 ? "es" : ""} más</span> : null}
      </div>
    </section>
  );
}
