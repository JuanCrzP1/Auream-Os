import { useCallback, useEffect, useState } from "react";
import type { NotificationFeed } from "@contracts/NotificationContracts";
import { notificationsApi } from "./notificationsApi";

/** Cada cuánto se revisan avisos nuevos mientras la pestaña está a la vista. */
export const NOTIFICATION_POLL_MS = 60_000;

/** Los avisos de la campana: al entrar, cada minuto con la pestaña visible y al volver a ella. */
export function useNotificationFeed() {
  const [feed, setFeed] = useState<NotificationFeed | null>(null);

  const refresh = useCallback(async () => {
    try {
      setFeed(await notificationsApi.feed());
    } catch {
      // Sin red o sin servidor: la campana se queda como estaba.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, NOTIFICATION_POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  /** Abrió la campana: el número rojo vuelve a cero (la lista sigue marcando lo nuevo). */
  const markSeen = useCallback(() => {
    setFeed((current) => (current ? { ...current, unread: 0 } : current));
    void notificationsApi.markSeen().catch(() => undefined);
  }, []);

  return { feed, refresh, markSeen };
}
