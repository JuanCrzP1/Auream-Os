import { useCallback, useEffect, useRef, useState } from "react";
import type { UpdateWebhookRequest, WebhookDelivery, WebhookDetail, WebhookMapping } from "@contracts/WebhookContracts";
import { RequestError } from "@shared/http/RequestError";
import { fetchWebhook, fetchWebhookDeliveries, updateWebhook } from "@shared/webhooks/webhooksApi";

/** Cada cuánto se mira si llegó el envío de ejemplo, y hasta cuándo. */
export const SAMPLE_POLL_MS = 2_000;
export const SAMPLE_WAIT_MS = 3 * 60_000;

export type WebhookEditorStatus = "loading" | "ready" | "not_found" | "error";

/** Lo que se edita y se guarda junto. */
export interface WebhookDraft {
  readonly name: string;
  readonly enabled: boolean;
  readonly connectionId: string | null;
  readonly mapping: WebhookMapping;
}

const draftOf = (webhook: WebhookDetail): WebhookDraft => ({ name: webhook.name, enabled: webhook.enabled, connectionId: webhook.connectionId, mapping: webhook.mapping });

/**
 * useWebhookEditor — la página de un webhook: lo carga, lleva el borrador
 * (nombre, activo, número, mapeo), lo guarda, espera el envío de ejemplo
 * (mira cada 2 s hasta 3 min) y carga el historial.
 */
export function useWebhookEditor(id: string) {
  const [webhook, setWebhook] = useState<WebhookDetail | null>(null);
  const [draft, setDraft] = useState<WebhookDraft | null>(null);
  const [status, setStatus] = useState<WebhookEditorStatus>("loading");
  const [listening, setListening] = useState(false);
  const [history, setHistory] = useState<WebhookDelivery[] | null>(null);
  const stopListening = useRef<() => void>(() => undefined);

  const load = useCallback(async () => {
    try {
      const loaded = await fetchWebhook(id);
      setWebhook(loaded);
      setDraft(draftOf(loaded));
      setStatus("ready");
    } catch (error) {
      setStatus(error instanceof RequestError && error.status === 404 ? "not_found" : "error");
    }
  }, [id]);

  useEffect(() => {
    void load();
    return () => stopListening.current();
  }, [load]);

  const dirty = webhook !== null && draft !== null && JSON.stringify(draftOf(webhook)) !== JSON.stringify(draft);

  const save = useCallback(async () => {
    if (!draft) return;
    const request: UpdateWebhookRequest = { name: draft.name, enabled: draft.enabled, connectionId: draft.connectionId, mapping: draft.mapping };
    const saved = await updateWebhook(id, request);
    setWebhook(saved);
    setDraft(draftOf(saved));
  }, [draft, id]);

  /** Espera el próximo envío: cuando llega, lo muestra para mapear (sin tocar el borrador). */
  const listen = useCallback(() => {
    stopListening.current();
    const since = webhook?.sampleReceivedAt ?? "";
    const startedAt = Date.now();
    setListening(true);
    const timer = setInterval(() => {
      void fetchWebhook(id)
        .then((fresh) => {
          if (fresh.sampleReceivedAt && fresh.sampleReceivedAt !== since) {
            setWebhook((current) => (current ? { ...current, sample: fresh.sample, sampleReceivedAt: fresh.sampleReceivedAt } : fresh));
            stopListening.current();
          } else if (Date.now() - startedAt > SAMPLE_WAIT_MS) {
            stopListening.current();
          }
        })
        .catch(() => undefined);
    }, SAMPLE_POLL_MS);
    stopListening.current = () => {
      clearInterval(timer);
      setListening(false);
      stopListening.current = () => undefined;
    };
  }, [id, webhook?.sampleReceivedAt]);

  const loadHistory = useCallback(async () => {
    setHistory(await fetchWebhookDeliveries(id));
  }, [id]);

  return {
    webhook,
    draft,
    status,
    dirty,
    listening,
    history,
    setDraft,
    save,
    listen,
    cancelListening: () => stopListening.current(),
    loadHistory,
    reload: load
  };
}
