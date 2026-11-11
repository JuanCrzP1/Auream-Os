import "./campaign-posts.css";
import type { CampaignSummary } from "@contracts/GroupContracts";

/** Lo que pasa solo en todos los grupos de la campaña (se cambia en «Editar»). */
export function CampaignRules({ campaign, canManage, onEdit }: { readonly campaign: CampaignSummary; readonly canManage: boolean; readonly onEdit: () => void }) {
  const { rules, template } = campaign;
  const items: ReadonlyArray<readonly [boolean, string, string]> = [
    [rules.welcome.enabled, "Bienvenida en el grupo", `Cada ${rules.welcome.everyMinutes} min, un solo mensaje: «${rules.welcome.text.replace("{nombres}", "@Laura, @Andrés y 12 más")}»`],
    [rules.labelOnJoin, "Etiqueta al entrar", `Quien entra queda en el CRM con «${campaign.name}».`],
    [template.announce, "Solo los administradores escriben", "El grupo es para tus anuncios, no para charlas."],
    [template.locked, "Solo los administradores editan", "Nadie más cambia el nombre, la foto ni la descripción."]
  ];
  return (
    <section className="gr-panel" aria-label="Automático">
      <div className="gr-panel__head">
        <h2>Automático en todos los grupos</h2>
        {canManage ? <button type="button" className="ui-link" onClick={onEdit}>Cambiar</button> : null}
      </div>
      <ul className="gr-rules">
        {items.map(([on, title, detail]) => (
          <li key={title} className={on ? "gr-rules__on" : "gr-rules__off"}>
            <span className="gr-rules__dot" aria-hidden="true">{on ? "✓" : "–"}</span>
            <span><strong>{title}</strong>{on ? detail : "Apagado."}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
