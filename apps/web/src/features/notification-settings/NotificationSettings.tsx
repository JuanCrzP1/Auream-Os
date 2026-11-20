import "./notification-settings.css";
import { useCallback, useEffect, useState } from "react";
import type { NotificationSettingsResponse } from "@contracts/NotificationSettingsContracts";
import { RetryButton, StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { notificationSettingsApi } from "@shared/notifications/devicePush";
import { DevicePushSection } from "./DevicePushSection";
import { TopicsSection } from "./TopicsSection";

/**
 * Configuración › Tu cuenta › Notificaciones: los avisos que suenan en el
 * celular o el computador aunque Auream esté cerrado. Cada persona los activa
 * en cada dispositivo y elige qué le suena en esta empresa.
 */
export function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettingsResponse | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setSettings(await notificationSettingsApi.get());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed && !settings) {
    return (
      <StateCard
        role="alert"
        tone="warning"
        icon={StateIcons.offline}
        title="No pudimos cargar tus notificaciones"
        description="Parece un problema de conexión momentáneo. Vuelve a intentarlo en unos segundos."
        actions={<RetryButton busy={false} onRetry={() => void load()} />}
      />
    );
  }
  if (!settings) return <div className="notif-loading" aria-busy="true" aria-label="Cargando tus notificaciones" />;

  return (
    <div className="notif-page">
      <DevicePushSection settings={settings} onChange={setSettings} reload={load} />
      {settings.topics.length > 0 ? <TopicsSection settings={settings} onChange={setSettings} /> : null}
    </div>
  );
}
