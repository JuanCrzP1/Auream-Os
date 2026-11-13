import "./wizard-kit.css";
import "./audience-step.css";
import { useState } from "react";
import type { AudienceFilter } from "@contracts/BroadcastContracts";
import { COUNTRIES } from "@contracts/Countries";
import { FieldFilterEditor } from "@shared/contact-fields/FieldFilterEditor";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { broadcastsApi } from "../services/broadcastsApi";
import type { BroadcastDraft } from "./broadcastDraft";
import { LabelPicker } from "./LabelPicker";
import type { WizardData } from "./useWizardData";

const WROTE = [[7, "7 días"], [30, "30 días"], [60, "60 días"], [90, "90 días"], [180, "6 meses"], [null, "Cuando sea"]] as const;
const BOUGHT = [[null, "No excluir"], [7, "7 días"], [30, "30 días"], [90, "90 días"]] as const;

/** Paso 2: siempre gente que ya escribió; los filtros cambian el número en vivo (a la derecha). */
export function AudienceStep({ draft, update, data }: {
  readonly draft: BroadcastDraft;
  readonly update: (patch: Partial<BroadcastDraft>) => void;
  readonly data: WizardData & { readonly reloadAudiences: () => void };
}) {
  const audience = draft.audience;
  const set = (patch: Partial<AudienceFilter>) => update({ audience: { ...audience, ...patch } });
  const [name, setName] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const toggleCountry = (code: string) => set({ countries: audience.countries.includes(code) ? audience.countries.filter((c) => c !== code) : [...audience.countries, code] });
  const same = (other: AudienceFilter) => JSON.stringify(other) === JSON.stringify(audience);

  const save = async () => {
    setSaving("…");
    try {
      await broadcastsApi.saveAudience(name, audience);
      setName("");
      setSaving(null);
      data.reloadAudiences();
    } catch (failure) {
      setSaving(apiErrorMessage(failure, "No se pudo guardar."));
    }
  };

  return (
    <div className="bc-step">
      <div className="bc-step__head">
        <h2>¿A quién?</h2>
        <p>Solo a gente que ya te escribió: es lo que más protege tu número. Quien pidió no recibir más, nunca.</p>
      </div>

      {data.audiences.length > 0 ? (
        <div className="bc-group">
          <span className="bc-group__label">Audiencias guardadas</span>
          <div className="bc-chips">
            {data.audiences.map((saved) => (
              <button key={saved.id} type="button" className={`bc-chip${same(saved.audience) ? " bc-chip--on" : ""}`} onClick={() => update({ audience: saved.audience })}>
                {saved.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="bc-row-fields">
        <label className="ui-field">
          <span>Escribió en los últimos</span>
          <select className="ui-input" value={String(audience.lastInboundDays)} onChange={(event) => set({ lastInboundDays: event.target.value === "null" ? null : Number(event.target.value) })}>
            {WROTE.map(([days, label]) => <option key={label} value={String(days)}>{label}</option>)}
          </select>
        </label>
        <label className="ui-field">
          <span>Sin compras en los últimos</span>
          <select className="ui-input" value={String(audience.excludeBoughtDays)} onChange={(event) => set({ excludeBoughtDays: event.target.value === "null" ? null : Number(event.target.value) })}>
            {BOUGHT.map(([days, label]) => <option key={label} value={String(days)}>{label}</option>)}
          </select>
        </label>
      </div>

      <LabelPicker labels={data.labels} pipelines={data.pipelines} include={audience.labelIds} exclude={audience.excludeLabelIds} onChange={(labelIds, excludeLabelIds) => set({ labelIds, excludeLabelIds })} />

      <div className="bc-group">
        <span className="bc-group__label">País (por el prefijo del número)</span>
        <div className="bc-chips">
          {COUNTRIES.map((country) => (
            <button key={country.code} type="button" className={`bc-chip${audience.countries.includes(country.code) ? " bc-chip--on" : ""}`} aria-pressed={audience.countries.includes(country.code)} onClick={() => toggleCountry(country.code)}>
              {country.flag} {country.name}
            </button>
          ))}
        </div>
        <span className="bc-hint">Sin elegir, todos los países.</span>
      </div>

      {data.fields.length > 0 ? (
        <div className="bc-group">
          <span className="bc-group__label">Por sus datos (Campos del cliente)</span>
          <FieldFilterEditor
            fields={data.fields}
            value={audience.fields ?? []}
            onChange={(fields) => {
              // Sin filtros la audiencia queda igual que antes de existir los campos (y las guardadas siguen coincidiendo).
              const { fields: _previous, ...rest } = audience;
              update({ audience: fields.length > 0 ? { ...rest, fields } : rest });
            }}
          />
          <span className="bc-hint">Ej.: Ciudad es una de Medellín y Ya compró es Sí. Se cumplen todos.</span>
        </div>
      ) : null}

      <div className="bc-save-audience">
        <input className="ui-input" placeholder="Nombre, ej. Interesados Colombia" value={name} maxLength={60} aria-label="Nombre de la audiencia" onChange={(event) => setName(event.target.value)} />
        <button type="button" className="ui-btn" disabled={!name.trim() || saving === "…"} onClick={() => void save()}>Guardar audiencia</button>
        {saving && saving !== "…" ? <span className="ui-error">{saving}</span> : null}
      </div>
    </div>
  );
}
