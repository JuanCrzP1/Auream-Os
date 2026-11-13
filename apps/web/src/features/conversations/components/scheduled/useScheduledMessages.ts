import { useCallback, useEffect, useRef, useState } from "react";
import type { ScheduleMessageRequest, ScheduledMessage, ScheduledMessagesResponse, UpdateScheduledMessageRequest } from "@contracts/ScheduledMessageContracts";
import { scheduledApi } from "../../services/scheduledApi";

// ---------------------------------------------------------------------------
// Los programados del chat abierto. Se piden al abrirlo y cada vez que la
// bandeja dice que cambiaron (`signal`: el próximo pendiente y si alguno no
// salió, que llegan con el chat en vivo): así, cuando uno sale a su hora,
// desaparece de aquí y aparece en el hilo sin recargar.
// ---------------------------------------------------------------------------

export interface ScheduledMessages {
  readonly messages: ReadonlyArray<ScheduledMessage>;
  /** Zona del negocio; `null` hasta la primera respuesta. */
  readonly timeZone: string | null;
  schedule(request: ScheduleMessageRequest): Promise<void>;
  update(id: string, request: UpdateScheduledMessageRequest): Promise<void>;
  sendNow(id: string): Promise<void>;
  cancel(id: string): Promise<void>;
}

export function useScheduledMessages(conversationId: string, signal: string): ScheduledMessages {
  const [state, setState] = useState<{ readonly messages: ReadonlyArray<ScheduledMessage>; readonly timeZone: string | null }>({ messages: [], timeZone: null });
  const current = useRef(conversationId);
  current.current = conversationId;

  const apply = useCallback((forChat: string, response: ScheduledMessagesResponse) => {
    if (current.current === forChat) setState({ messages: response.messages, timeZone: response.timeZone });
  }, []);

  const reload = useCallback(() => {
    const forChat = conversationId;
    scheduledApi.list(forChat).then((response) => apply(forChat, response), () => undefined);
  }, [conversationId, apply]);

  useEffect(() => {
    setState({ messages: [], timeZone: null });
  }, [conversationId]);

  useEffect(reload, [reload, signal]);

  /** Cada cambio responde con la lista nueva; si falla, se vuelve a pedir (puede haber cambiado) y se avisa. */
  const run = useCallback(
    async (call: () => Promise<ScheduledMessagesResponse>) => {
      const forChat = conversationId;
      try {
        apply(forChat, await call());
      } catch (error) {
        reload();
        throw error;
      }
    },
    [conversationId, apply, reload]
  );

  return {
    ...state,
    schedule: (request) => run(() => scheduledApi.schedule(conversationId, request)),
    update: (id, request) => run(() => scheduledApi.update(conversationId, id, request)),
    sendNow: (id) => run(() => scheduledApi.sendNow(conversationId, id)),
    cancel: (id) => run(() => scheduledApi.cancel(conversationId, id))
  };
}
