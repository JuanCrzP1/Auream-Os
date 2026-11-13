import { useRef, useState } from "react";
import { GROUP_LIMITS, type SaveCampaignRequest } from "@contracts/GroupContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { uploadGroupPhoto } from "./groupPhoto";

const EVERY = GROUP_LIMITS.welcomeEveryMinutes;

/** Cómo es cada grupo (nombre « #n», foto, descripción, cupo, reglas) y lo automático. */
export function TemplateFields({ draft, update }: { readonly draft: SaveCampaignRequest; readonly update: (patch: Partial<SaveCampaignRequest>) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const template = draft.template;
  const setTemplate = (patch: Partial<SaveCampaignRequest["template"]>) => update({ template: { ...template, ...patch } });
  const setWelcome = (patch: Partial<SaveCampaignRequest["rules"]["welcome"]>) => update({ rules: { ...draft.rules, welcome: { ...draft.rules.welcome, ...patch } } });

  const pick = async (picked: File | undefined) => {
    if (!picked) return;
    setUploading(true);
    setError(null);
    try {
      setTemplate({ imageUrl: await uploadGroupPhoto(picked) });
    } catch (failure) {
      setError(apiErrorMessage(failure, "No se pudo subir la foto."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="gr-editor__grid">
        <label className="ui-field">
          <span>Nombre de cada grupo (se agrega « #1», « #2»…)</span>
          <input className="ui-input" value={template.namePattern} maxLength={GROUP_LIMITS.maxNamePattern} placeholder="Ej. Navidad · Dilo cantando" onChange={(event) => setTemplate({ namePattern: event.target.value })} />
        </label>
        <CapacityField key={draft.capacity} value={draft.capacity} onChange={(capacity) => update({ capacity })} />
      </div>
      <label className="ui-field">
        <span>Descripción del grupo</span>
        <textarea className="ui-input gr-editor__text" rows={3} maxLength={GROUP_LIMITS.maxDescription} value={template.description} placeholder="Qué van a encontrar en el grupo y sus reglas." onChange={(event) => setTemplate({ description: event.target.value })} />
      </label>
      <div className="gr-editor__photo">
        {template.imageUrl ? <img src={template.imageUrl} alt="Foto del grupo" /> : <span className="gr-editor__photo-empty" aria-hidden="true">📷</span>}
        <button type="button" className="ui-btn" disabled={uploading} onClick={() => file.current?.click()}>{uploading ? "Subiendo…" : template.imageUrl ? "Cambiar foto" : "Subir foto del grupo"}</button>
        {template.imageUrl ? <button type="button" className="ui-link" onClick={() => setTemplate({ imageUrl: null })}>Quitar</button> : null}
        <input ref={file} type="file" accept="image/*" hidden onChange={(event) => void pick(event.target.files?.[0])} />
        {error ? <span className="ui-error">{error}</span> : null}
      </div>
      <div className="gr-editor__switches">
        <Switch on={template.announce} title="Solo los administradores escriben" detail="El grupo es para tus anuncios, no para charlas." onChange={(announce) => setTemplate({ announce })} />
        <Switch on={template.locked} title="Solo los administradores editan" detail="Nadie más cambia el nombre, la foto ni la descripción." onChange={(locked) => setTemplate({ locked })} />
        <Switch on={draft.rules.labelOnJoin} title="Etiqueta al entrar" detail={`Quien entra queda en el CRM con «${draft.name || "el nombre de la campaña"}».`} onChange={(labelOnJoin) => update({ rules: { ...draft.rules, labelOnJoin } })} />
        <Switch on={draft.rules.welcome.enabled} title="Bienvenida en el grupo" detail="Un solo mensaje por tanda, mencionando a los que entraron." onChange={(enabled) => setWelcome({ enabled })} />
      </div>
      {draft.rules.welcome.enabled ? (
        <div className="gr-editor__grid">
          <label className="ui-field">
            <span>Mensaje de bienvenida ({"{nombres}"} pone las menciones)</span>
            <textarea className="ui-input gr-editor__text" rows={2} maxLength={GROUP_LIMITS.maxWelcome} value={draft.rules.welcome.text} onChange={(event) => setWelcome({ text: event.target.value })} />
          </label>
          <label className="ui-field">
            <span>Cada</span>
            <select className="ui-input" value={draft.rules.welcome.everyMinutes} onChange={(event) => setWelcome({ everyMinutes: Number(event.target.value) })}>
              {EVERY.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutos</option>)}
            </select>
          </label>
        </div>
      ) : null}
    </>
  );
}

function Switch({ on, title, detail, onChange }: { readonly on: boolean; readonly title: string; readonly detail: string; readonly onChange: (on: boolean) => void }) {
  return (
    <label className="gr-editor__switch">
      <input type="checkbox" checked={on} onChange={(event) => onChange(event.target.checked)} />
      <span><strong>{title}</strong>{detail}</span>
    </label>
  );
}

/** Se escribe libre y se ajusta al límite (20 a 1024) solo al salir del campo: así se puede escribir «50» sin que salte a 20. */
function CapacityField({ value, onChange }: { readonly value: number; readonly onChange: (capacity: number) => void }) {
  const [text, setText] = useState(String(value));
  const commit = () => {
    const typed = Number(text);
    const capacity = Number.isFinite(typed) && text.trim() ? Math.max(GROUP_LIMITS.minCapacity, Math.min(GROUP_LIMITS.maxCapacity, Math.round(typed))) : value;
    setText(String(capacity));
    if (capacity !== value) onChange(capacity);
  };
  return (
    <label className="ui-field">
      <span>Cupo por grupo</span>
      <input className="ui-input" inputMode="numeric" value={text} aria-describedby="gr-capacity-hint"
        onChange={(event) => setText(event.target.value.replace(/\D/g, "").slice(0, 4))}
        onBlur={commit}
        onKeyDown={(event) => { if (event.key === "Enter") commit(); }} />
      <small id="gr-capacity-hint" className="ui-muted">Entre {GROUP_LIMITS.minCapacity} y {GROUP_LIMITS.maxCapacity} personas.</small>
    </label>
  );
}
