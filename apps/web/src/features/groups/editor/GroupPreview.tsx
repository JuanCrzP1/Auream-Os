import "./group-preview.css";
import type { SaveCampaignRequest } from "@contracts/GroupContracts";

/** Cómo se verá cada grupo en WhatsApp: la ficha y la bienvenida. */
export function GroupPreview({ draft }: { readonly draft: SaveCampaignRequest }) {
  const name = `${(draft.template.namePattern || draft.name || "Tu grupo").slice(0, 21)} #1`;
  const welcome = draft.rules.welcome.text.replace("{nombres}", "@Laura, @Andrés y 12 más");
  return (
    <section className="gr-preview" aria-label="Así se verá el grupo">
      <div className="gr-preview__info">
        {draft.template.imageUrl ? <img src={draft.template.imageUrl} alt="" /> : <span className="gr-preview__avatar" aria-hidden="true">👥</span>}
        <strong>{name}</strong>
        <small>Grupo · {draft.capacity} cupos</small>
        {draft.template.description ? <p>{draft.template.description}</p> : <p className="gr-preview__muted">Sin descripción</p>}
        <span className="gr-preview__rule">{draft.template.announce ? "🔒 Solo los administradores envían mensajes" : "Todos pueden escribir"}</span>
      </div>
      <div className="gr-preview__chat">
        <span className="gr-preview__system">Te uniste usando el enlace de invitación</span>
        {draft.rules.welcome.enabled ? <span className="gr-preview__bubble">{welcome}<small>10:02</small></span> : null}
      </div>
    </section>
  );
}
