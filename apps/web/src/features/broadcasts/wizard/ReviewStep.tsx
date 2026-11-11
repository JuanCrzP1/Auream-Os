import "./wizard-kit.css";
import "./review-step.css";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import type { FlowOption } from "@shared/automations/flowOptions";
import { count } from "../broadcastFormat";
import { variantCount, type BroadcastDraft } from "./broadcastDraft";

const SHARES = [10, 20, 30, 50];
const DECIDE = [[6, "6 horas"], [12, "12 horas"], [24, "1 día"], [48, "2 días"]] as const;
const FOLLOW = [[24, "1 día"], [48, "2 días"], [72, "3 días"], [120, "5 días"]] as const;

/** Paso 4: nombre, resumen, prueba A/B (con 2 o más versiones) y segundo envío. */
export function ReviewStep({ draft, update, flows, connections, reach }: {
  readonly draft: BroadcastDraft;
  readonly update: (patch: Partial<BroadcastDraft>) => void;
  readonly flows: ReadonlyArray<FlowOption>;
  readonly connections: ReadonlyArray<ConnectionSummary>;
  readonly reach: number | null;
}) {
  const versions = variantCount(draft);
  const what = draft.kind === "flow" ? draft.flowIds.map((id) => `«${flows.find((f) => f.id === id)?.name ?? "?"}»`).join(", ") : draft.messages.some((m) => m.media) ? "Mensaje con foto o video" : "Mensaje de texto";
  const rows: ReadonlyArray<readonly [string, string]> = [
    ["Envía", `${draft.kind === "flow" ? "Flujo" : ""} ${what}${versions > 1 ? ` · ${versions} versiones` : ""}`.trim()],
    ["A", reach === null ? "calculando…" : `${count(reach)} personas que ya te escribieron`],
    ["Por", connections.filter((c) => draft.connectionIds.includes(c.id)).map((c) => c.name).join(", ") || "—"],
    ["Cuándo", draft.scheduledAt ? new Date(draft.scheduledAt).toLocaleString("es", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "Ahora, con ritmo seguro"],
    ["Cuenta como venta", "si compra en los 3 días siguientes"]
  ];

  return (
    <div className="bc-step">
      <div className="bc-step__head">
        <h2>Revisa y envía</h2>
      </div>
      <label className="ui-field">
        <span>Nombre de la difusión</span>
        <input className="ui-input" value={draft.name} maxLength={80} placeholder="Ej. Promo Día de la Madre" onChange={(event) => update({ name: event.target.value })} />
      </label>
      <dl className="bc-summary">
        {rows.map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {versions > 1 ? (
        <div className="bc-extra">
          <label className="bc-switch">
            <input type="checkbox" checked={Boolean(draft.abTest)} onChange={(event) => update({ abTest: event.target.checked ? { sharePercent: 20, decideAfterHours: 12 } : null })} />
            <div>
              <strong>Prueba A/B por ventas</strong>
              <span>{draft.abTest ? "Una parte recibe cada versión y al resto le llega la que más vendió." : `Sin prueba, cada persona recibe una de las ${versions} versiones al azar.`}</span>
            </div>
          </label>
          {draft.abTest ? (
            <div className="bc-row-fields">
              <label className="ui-field">
                <span>Prueban</span>
                <select className="ui-input" value={draft.abTest.sharePercent} onChange={(event) => update({ abTest: { ...draft.abTest!, sharePercent: Number(event.target.value) } })}>
                  {SHARES.map((share) => <option key={share} value={share}>{share} % de la lista</option>)}
                </select>
              </label>
              <label className="ui-field">
                <span>Decide después de</span>
                <select className="ui-input" value={draft.abTest.decideAfterHours} onChange={(event) => update({ abTest: { ...draft.abTest!, decideAfterHours: Number(event.target.value) } })}>
                  {DECIDE.map(([hours, label]) => <option key={hours} value={hours}>{label}</option>)}
                </select>
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="bc-extra">
        <label className="bc-switch">
          <input type="checkbox" checked={Boolean(draft.followUp)} onChange={(event) => update({ followUp: event.target.checked ? { afterHours: 48, text: "Hola {first_name}, ¿pudiste verlo? Si tienes alguna duda, aquí estoy." } : null })} />
          <div>
            <strong>Segundo envío a los que no respondieron</strong>
            <span>Solo a quien no respondió, ni compró, ni pidió salir.</span>
          </div>
        </label>
        {draft.followUp ? (
          <>
            <label className="ui-field">
              <span>Cuándo, después de terminar</span>
              <select className="ui-input" value={draft.followUp.afterHours} onChange={(event) => update({ followUp: { ...draft.followUp!, afterHours: Number(event.target.value) } })}>
                {FOLLOW.map(([hours, label]) => <option key={hours} value={hours}>{label}</option>)}
              </select>
            </label>
            <textarea className="ui-input bc-extra__text" rows={3} maxLength={1000} value={draft.followUp.text} aria-label="Mensaje del segundo envío" onChange={(event) => update({ followUp: { ...draft.followUp!, text: event.target.value } })} />
          </>
        ) : null}
      </div>
    </div>
  );
}
