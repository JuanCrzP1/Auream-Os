import "./label-drawer.css";
import { useId, useState } from "react";
import type { LabelOverview } from "@contracts/LabelManagementContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { LabelColorPicker } from "@shared/labels/LabelColorPicker";
import { salesText, stageOf, usesText } from "../labelText";
import { LabelUses } from "./LabelUses";

/**
 * El detalle de una etiqueta: sus clientes, lo que vendieron, dónde trabaja
 * y, según el rol, cambiarle el color (el Asesor) o el nombre, unirla con
 * otra y borrarla (dueños y administradores). Renombrar la cambia también en
 * los flujos y webhooks que la nombran.
 */
export function LabelDrawer({
  label,
  canEdit,
  canManage,
  onSave,
  onMerge,
  onDelete,
  onClose
}: {
  readonly label: LabelOverview;
  readonly canEdit: boolean;
  readonly canManage: boolean;
  readonly onSave: (changes: { name?: string; color?: string }) => Promise<unknown>;
  readonly onMerge: () => void;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const nameId = useId();
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const renamed = name.trim() !== label.name;
  const dirty = renamed || color !== label.color;
  const stage = stageOf(label.uses);
  const flows = usesText(label.uses.filter((use) => use.kind === "flow" || use.kind === "webhook"));
  const sales = salesText(label.sales);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave({ ...(renamed ? { name: name.trim() } : {}), ...(color !== label.color ? { color } : {}) });
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo guardar la etiqueta."));
      setBusy(false);
    }
  };

  return (
    <div className="lb-drawer-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <aside className="lb-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="lb-drawer__hero">
          <button type="button" className="lb-drawer__close" aria-label="Cerrar" onClick={onClose}>×</button>
          <span className="lb-drawer__eyebrow">{stage ? `Etiqueta · etapa del embudo «${stage.pipelineName}»` : "Etiqueta"}</span>
          <h2 id={titleId}><span className="lb-dot" style={{ background: label.color }} aria-hidden="true" />{label.name}</h2>
          <span className="lb-drawer__facts">
            <span><strong>{(label.contactCount ?? 0).toLocaleString("es-CO")}</strong> clientes</span>
            {sales ? <span title={sales.title}><strong>{sales.text}</strong> vendieron en 30 días</span> : null}
          </span>
        </header>

        <div className="lb-drawer__body">
          {canEdit ? (
            <section className="lb-drawer__section" aria-label="Cambiar la etiqueta">
              <div className="ui-field">
                <label htmlFor={nameId}>Nombre</label>
                <input id={nameId} className="ui-input" value={name} maxLength={40} disabled={!canManage} aria-describedby={`${nameId}-note`} onChange={(e) => setName(e.target.value)} />
                <span id={`${nameId}-note`} className={canManage ? "lb-drawer__warn" : "lb-drawer__hint"}>
                  {!canManage ? "El nombre lo cambian los dueños y administradores: los flujos la usan por su nombre." : renamed && flows ? `También cambia en ${flows}.` : ""}
                </span>
              </div>
              <div className="ui-field">
                <span>Color</span>
                <LabelColorPicker value={color} onChange={setColor} />
              </div>
            </section>
          ) : null}

          <section className="lb-drawer__section" aria-label="Dónde trabaja">
            <h3>Dónde trabaja</h3>
            <LabelUses uses={label.uses} empty="Ningún flujo, embudo, difusión ni webhook la usa: solo la tienen sus clientes." />
          </section>
          {error ? <p className="ui-error" role="alert">{error}</p> : null}
        </div>

        {canEdit ? (
          <footer className="lb-drawer__footer">
            {canManage ? (
              <span className="lb-drawer__links">
                <button type="button" className="lb-drawer__link" onClick={onMerge} disabled={busy || Boolean(stage)} title={stage ? "Una etapa no se une en otra: une la otra en esta." : undefined}>Unir con otra</button>
                <button type="button" className="lb-drawer__link lb-drawer__link--danger" onClick={onDelete} disabled={busy}>Borrar</button>
              </span>
            ) : <span />}
            <button type="button" className="ui-btn ui-btn--primary" disabled={!dirty || busy || !name.trim()} onClick={() => void save()}>
              {busy ? "Guardando…" : "Guardar cambios"}
            </button>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
