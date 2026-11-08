import "../_kit/kit.css";
import type { ToolCompactProps } from "../ToolUi";
import { readNotificationConfig } from "./notificationConfig";

/** Nodo cerrado: a quién se avisa y un extracto del mensaje. */
export function NotificationCompactBody({ draft }: ToolCompactProps) {
  const { name, countryCode, phone, message } = readNotificationConfig(draft.config);

  if (phone.length === 0) return <p className="kit-node__empty">Sin destinatario</p>;

  return (
    <div className="kit-node">
      <span className="kit-node__eyebrow">Avisar a {name.trim() || "equipo"}</span>
      <span className="kit-node__meta">+{countryCode} {phone}</span>
      {message.trim() ? <p className="kit-node__quote">{message.replace(/\s+/g, " ").trim()}</p> : null}
    </div>
  );
}
