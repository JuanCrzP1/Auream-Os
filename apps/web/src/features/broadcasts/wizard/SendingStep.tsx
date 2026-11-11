import "./wizard-kit.css";
import "./sending-step.css";
import { BROADCAST_LIMITS, PACE_SECONDS, type BroadcastSettings } from "@contracts/BroadcastContracts";
import type { AudiencePreview } from "@contracts/BroadcastResultsContracts";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import { count } from "../broadcastFormat";
import type { BroadcastDraft } from "./broadcastDraft";
import { canBroadcast, whyNot } from "./numbers";

const HOURS = Array.from({ length: 25 }, (_, hour) => hour);
const hourLabel = (hour: number) => (hour === 0 || hour === 24 ? "12 a. m." : hour === 12 ? "12 p. m." : hour < 12 ? `${hour} a. m.` : `${hour - 12} p. m.`);
/** `datetime-local` de dentro de una hora, en punto. */
const inAnHour = () => {
  const at = new Date(Date.now() + 3_600_000);
  at.setMinutes(0, 0, 0);
  return new Date(at.getTime() - at.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

/** Paso 3: por cuál número (cada cliente lo recibe por el que ya le habla), cuándo y a qué ritmo. */
export function SendingStep({ draft, update, connections, preview }: {
  readonly draft: BroadcastDraft;
  readonly update: (patch: Partial<BroadcastDraft>) => void;
  readonly connections: ReadonlyArray<ConnectionSummary>;
  readonly preview: AudiencePreview | null;
}) {
  const settings = draft.settings;
  const setSettings = (patch: Partial<BroadcastSettings>) => update({ settings: { ...settings, ...patch } });
  const toggle = (id: string) => update({ connectionIds: draft.connectionIds.includes(id) ? draft.connectionIds.filter((x) => x !== id) : [...draft.connectionIds, id] });

  return (
    <div className="bc-step">
      <div className="bc-step__head">
        <h2>¿Por cuál número y cuándo?</h2>
        <p>Cada cliente la recibe por el número en que ya te habla. Con varios números, termina antes.</p>
      </div>

      <div className="bc-choices">
        {connections.map((connection) => {
          const reason = whyNot(connection);
          const pace = preview?.numbers.find((n) => n.connectionId === connection.id);
          const people = preview?.perConnection.find((n) => n.connectionId === connection.id)?.count;
          return (
            <button key={connection.id} type="button" className="bc-choice" aria-pressed={draft.connectionIds.includes(connection.id)} disabled={!canBroadcast(connection)} onClick={() => toggle(connection.id)}>
              <strong>{connection.name}</strong>
              <span>{reason ?? (people !== undefined ? `${count(people)} clientes hablan por aquí` : "Conectado")}</span>
              {pace?.warmupDay ? <span className="bc-warm">Calentando · día {pace.warmupDay} de 7 · hoy hasta {pace.capToday}</span> : null}
              {pace && !pace.warmupDay ? <span className="bc-ok">Hoy lleva {pace.sentToday} de {pace.capToday}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="bc-group">
        <span className="bc-group__label">Cuándo</span>
        <div className="bc-row-fields">
          <div className="bc-seg">
            <button type="button" aria-pressed={!draft.scheduledAt} onClick={() => update({ scheduledAt: null })}>Ahora</button>
            <button type="button" aria-pressed={Boolean(draft.scheduledAt)} onClick={() => update({ scheduledAt: draft.scheduledAt ?? inAnHour() })}>Programar</button>
          </div>
          {draft.scheduledAt ? <input className="ui-input" type="datetime-local" value={draft.scheduledAt} aria-label="Fecha y hora" onChange={(event) => update({ scheduledAt: event.target.value || null })} /> : null}
        </div>
      </div>

      <div className="bc-safe">
        <strong className="bc-safe__title">🛡 Envío seguro</strong>
        <div className="bc-row-fields">
          <label className="ui-field">
            <span>Ritmo</span>
            <select className="ui-input" value={settings.pace} onChange={(event) => setSettings({ pace: event.target.value === "careful" ? "careful" : "normal" })}>
              <option value="normal">Normal: {PACE_SECONDS.normal[0]} a {PACE_SECONDS.normal[1]} s entre mensajes</option>
              <option value="careful">Prudente: {PACE_SECONDS.careful[0]} a {PACE_SECONDS.careful[1]} s entre mensajes</option>
            </select>
          </label>
          <label className="ui-field">
            <span>Máximo por número al día</span>
            <input className="ui-input" type="number" min={BROADCAST_LIMITS.minDailyCap} max={BROADCAST_LIMITS.maxDailyCap} value={settings.dailyCap}
              onChange={(event) => setSettings({ dailyCap: Math.max(BROADCAST_LIMITS.minDailyCap, Math.min(BROADCAST_LIMITS.maxDailyCap, Number(event.target.value) || BROADCAST_LIMITS.defaultDailyCap)) })} />
          </label>
          <label className="ui-field">
            <span>Desde</span>
            <select className="ui-input" value={settings.fromHour} onChange={(event) => setSettings({ fromHour: Number(event.target.value) })}>
              {HOURS.slice(0, 23).map((hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}
            </select>
          </label>
          <label className="ui-field">
            <span>Hasta</span>
            <select className="ui-input" value={settings.toHour} onChange={(event) => setSettings({ toHour: Number(event.target.value) })}>
              {HOURS.slice(1).map((hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}
            </select>
          </label>
        </div>
        {draft.kind === "message" ? (
          <label className="bc-switch">
            <input type="checkbox" checked={settings.optOutFooter} onChange={(event) => setSettings({ optOutFooter: event.target.checked })} />
            <div>
              <strong>Agregar «Para no recibir más mensajes, responde SALIR»</strong>
              <span>Quien responda SALIR o «no quiero más» sale de todas tus difusiones.</span>
            </div>
          </label>
        ) : null}
        <ul className="bc-safe__list">
          <li>Las pausas son al azar: nunca un patrón fijo.</li>
          <li>Los primeros 7 días que un número envía difusiones, el tope sube de a poco (20, 40, 60…).</li>
          <li>Si falla más del 5 % o el número se desconecta, se pausa sola.</li>
        </ul>
        {preview && preview.count > 0 ? <span className="bc-safe__eta">{preview.days <= 1 ? "Termina el mismo día." : `Con estos topes tarda unos ${preview.days} días.`}</span> : null}
      </div>
    </div>
  );
}
