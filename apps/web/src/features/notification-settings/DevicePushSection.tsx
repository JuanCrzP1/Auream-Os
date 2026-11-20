import "./notification-devices.css";
import { useEffect, useState } from "react";
import type { NotificationSettingsResponse } from "@contracts/NotificationSettingsContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { timeAgo } from "@shared/format/timeAgo";
import { currentSubscription, disableOnThisDevice, enableOnThisDevice, notificationSettingsApi, pushSupport, rememberedDevice } from "@shared/notifications/devicePush";
import { NotificationIcons } from "./notificationIcons";

type Notice = { readonly tone: "ok" | "error"; readonly text: string } | null;

/**
 * «En este dispositivo»: activar, probar o desactivar los avisos aquí, y la
 * lista de los dispositivos de la persona (quitar los demás). En iPhone,
 * primero hay que instalar Auream; si el navegador los bloqueó, cómo
 * permitirlos.
 */
export function DevicePushSection({ settings, onChange, reload }: {
  readonly settings: NotificationSettingsResponse;
  readonly onChange: (next: NotificationSettingsResponse) => void;
  readonly reload: () => Promise<void>;
}) {
  const support = pushSupport();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [blocked, setBlocked] = useState(support === "supported" && Notification.permission === "denied");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const hereId = rememberedDevice();
  const here = subscribed === true && settings.devices.some((device) => device.id === hereId);

  useEffect(() => {
    void currentSubscription().then((subscription) => setSubscribed(subscription !== null)).catch(() => setSubscribed(false));
  }, [settings]);

  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    try {
      await work();
    } catch (error) {
      setNotice({ tone: "error", text: apiErrorMessage(error, "No se pudo completar. Vuelve a intentarlo.") });
    } finally {
      setBusy(false);
    }
  };

  const enable = () =>
    act(async () => {
      const result = await enableOnThisDevice(settings.push.publicKey!);
      if (result === "denied") setBlocked(true);
      if (result === "enabled") setNotice({ tone: "ok", text: "Listo: este dispositivo ya recibe avisos." });
      await reload();
    });
  const disable = () => act(async () => { await disableOnThisDevice(); await reload(); });
  const test = () => act(async () => {
    const { sent } = await notificationSettingsApi.test(hereId!);
    setNotice(sent ? { tone: "ok", text: "Enviamos un aviso de prueba: debería sonar en unos segundos." } : { tone: "error", text: "El servicio de avisos no respondió. Vuelve a intentarlo." });
  });
  const remove = (deviceId: string) => act(async () => onChange(await notificationSettingsApi.removeDevice(deviceId)));

  return (
    <section className="notif-section" aria-labelledby="notif-device-title">
      <div className="notif-section__head">
        <h2 id="notif-device-title">En este dispositivo</h2>
        <p>Suenan como un mensaje de WhatsApp aunque Auream esté cerrado. Actívalas en cada celular o computador donde atiendes.</p>
      </div>

      {!settings.push.available ? (
        <p className="notif-tip">{NotificationIcons.info}<span>Los avisos al celular todavía no están activos en Auream. Cuando lo estén, podrás activarlos aquí.</span></p>
      ) : support === "install" ? (
        <p className="notif-tip">{NotificationIcons.info}<span><strong>En iPhone, primero instala Auream:</strong> abre Auream en Safari, toca <strong>Compartir → «Agregar a pantalla de inicio»</strong> y entra desde ese ícono. Ahí podrás activar los avisos.</span></p>
      ) : support === "unsupported" ? (
        <p className="notif-tip">{NotificationIcons.info}<span>Este navegador no puede recibir avisos. Usa Chrome, Edge, Firefox o Safari actualizados.</span></p>
      ) : blocked ? (
        <p className="notif-tip notif-tip--warn" role="alert">{NotificationIcons.info}<span><strong>Bloqueaste los avisos para Auream en este navegador.</strong> Permítelos en el candado junto a la dirección y vuelve a intentarlo.</span></p>
      ) : (
        <div className="notif-row">
          {here ? <span className="notif-badge">● Activadas en este dispositivo</span> : null}
          {here ? (
            <>
              <button type="button" className="ui-btn" disabled={busy} onClick={() => void test()}>Enviar una prueba</button>
              <button type="button" className="ui-btn ui-btn--ghost" disabled={busy} onClick={() => void disable()}>Desactivar aquí</button>
            </>
          ) : (
            <button type="button" className="ui-btn ui-btn--primary" disabled={busy || subscribed === null} onClick={() => void enable()}>
              {busy ? "Activando…" : "Activar en este dispositivo"}
            </button>
          )}
        </div>
      )}
      {notice ? <p className={notice.tone === "ok" ? "notif-ok" : "ui-error"} role={notice.tone === "ok" ? "status" : "alert"}>{notice.text}</p> : null}

      {settings.devices.length > 0 ? (
        <ul className="notif-devices" aria-label="Tus dispositivos">
          {settings.devices.map((device) => {
            const isHere = here && device.id === hereId;
            return (
              <li key={device.id}>
                <span className="notif-devices__icon" aria-hidden="true">{/iphone|android|ipad/i.test(device.label) ? NotificationIcons.phone : NotificationIcons.laptop}</span>
                <span className="notif-devices__text">
                  <strong>{device.label}</strong>
                  <span>{isHere ? "Este dispositivo · " : ""}{device.lastUsedAt ? `último aviso ${timeAgo(device.lastUsedAt)}` : `activado ${timeAgo(device.createdAt)}`}</span>
                </span>
                {isHere ? null : <button type="button" className="ui-btn ui-btn--ghost" disabled={busy} onClick={() => void remove(device.id)}>Quitar</button>}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
