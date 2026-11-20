import "./notification-topics.css";
import { useState } from "react";
import type { NotificationSettingsResponse, PushTopic } from "@contracts/NotificationSettingsContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { notificationSettingsApi } from "@shared/notifications/devicePush";

const TOPICS: Readonly<Record<PushTopic, { readonly title: string; readonly description: string }>> = {
  chat_message: { title: "Un cliente te escribió", description: "En un chat que tú atiendes. Si escribe varias veces seguidas, el aviso se actualiza en vez de sonar otra vez." },
  number_disconnected: { title: "Número desconectado", description: "Un número de WhatsApp se desconectó y tus flujos dejaron de responder." },
  sale_review: { title: "Venta por revisar", description: "Llegó una venta que hay que revisar antes de contarla." },
  follow_up_due: { title: "Seguimiento", description: "Llegó la hora de un seguimiento del CRM que tienes asignado." }
};

/** «Qué te avisamos»: un interruptor por aviso (solo los que esta persona puede resolver). Se guarda al tocarlo. */
export function TopicsSection({ settings, onChange }: { readonly settings: NotificationSettingsResponse; readonly onChange: (next: NotificationSettingsResponse) => void }) {
  const [saving, setSaving] = useState<PushTopic | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (topic: PushTopic, enabled: boolean) => {
    setSaving(topic);
    setError(null);
    try {
      onChange(await notificationSettingsApi.setTopic(topic, enabled));
    } catch (cause) {
      setError(apiErrorMessage(cause, "No se pudo guardar. Vuelve a intentarlo."));
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="notif-section" aria-labelledby="notif-topics-title">
      <div className="notif-section__head">
        <h2 id="notif-topics-title">Qué te avisamos</h2>
        <p>Elige qué te suena. Al tocar un aviso, Auream te lleva directo a lo que pasó.</p>
      </div>
      <ul className="notif-topics">
        {settings.topics.map(({ topic, enabled }) => (
          <li key={topic}>
            <label className="notif-topics__row">
              <span className="notif-topics__text">
                <strong>{TOPICS[topic].title}</strong>
                <span>{TOPICS[topic].description}</span>
              </span>
              <input type="checkbox" role="switch" className="notif-switch" checked={enabled} disabled={saving === topic} onChange={(event) => void toggle(topic, event.target.checked)} />
            </label>
          </li>
        ))}
      </ul>
      {error ? <p className="ui-error" role="alert">{error}</p> : null}
    </section>
  );
}
