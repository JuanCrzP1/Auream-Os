# Conversaciones: chat en vivo, chulos de WhatsApp y «escribiendo…»

`domains/conversations` · `domains/messaging/application/FlowTurn.ts` · `domains/connections/application/ConnectionChannelServices.ts` · `infrastructure/whatsapp/uazapi` · `infrastructure/persistence/sql/SqlConversationThread.ts` · `020_conversation_live.sql` · `apps/web/src/shared/conversations` · `apps/web/src/features/conversations`

## Qué resuelve

- **En vivo:** cada mensaje del bot aparece en la bandeja apenas sale hacia WhatsApp, no al final del turno.
- **Chulos como WhatsApp:** uno gris (enviado), dos grises (entregado al teléfono), dos azules (leído), con los avisos reales de WhatsApp.
- **«Escribiendo…» y «grabando audio…»:** durante las pausas de un Mensaje el cliente ve, en su WhatsApp, que se le está escribiendo (o grabando un audio, si lo siguiente es un audio), como en Leona.

## Piezas y responsabilidades

| Pieza | Responsabilidad |
|---|---|
| `MessageNodeHandler` (motor) | Cada pausa declara qué ve el cliente mientras dura (`presenceBefore`): `recording` si lo siguiente es un audio, `composing` si es otra cosa, nada si es la última. Una pausa que no cabe en el turno sale como `presence` (solo se muestra; la retoma la cola de tareas). |
| `ConnectionChannelServices.deliver` | Envía en orden. En cada pausa muestra la presencia **a la vez** que espera (no la alarga); no muestra presencias de más de 5 min. Informa cada mensaje apenas sale (`onResult`) con el id que WhatsApp le dio. |
| `FlowTurn` | Guarda cada mensaje en la bandeja en el momento en que sale (`onResult` → `ConversationRecorder.recordOutbound`). |
| `ConversationRecorder` | Guarda el hilo (cliente, bot, asesor) con el id de WhatsApp; aplica los avisos de entregado/leído (`applyReceipts`) y los reintenta si llegan antes de que el mensaje quede guardado. |
| `SqlConversationThread` | `markDelivery`: avanza el estado solo hacia adelante (enviado → entregado → leído), solo de lo que salió por ese número. `changesSince`: lo nuevo o cambiado desde una marca (`updated_at`, con 5 s de solape). |
| `parseUazapiReceipt` + `routeWhatsAppWebhooks` | Leen el aviso `messages_update` de uazapi (verificado con el token de la instancia) y lo aplican en segundo plano. |
| `ProviderWebhookKeeper` | Mantiene al día los eventos que cada número pide a uazapi (`connection`, `messages`, `messages_update`). Lo hace el primer aviso de cada número tras un despliegue: nadie tiene que tocar nada. |
| Web: `LivePoller` | Consulta una a la vez; cada 1,5 s con movimiento (un minuto tras cualquier cambio) y cada 4 s en calma; nada con la pestaña oculta y enseguida al volver. |
| Web: `useConversationThread` + `mergeThread` | `GET /conversations/:id/live` (primera vez el hilo, después solo `since`) y une por id: los mensajes nuevos entran en su lugar y los que cambian (chulos) se reemplazan. |
| Web: `MessageBubble` + `DeliveryTicks` + `chatBubbles.css` | La burbuja compacta (texto de 14 px) con su hora y sus chulos. |

## Recorrido de un mensaje del bot

```
motor ──> salidas (pausa «escribiendo…», texto, pausa «grabando audio…», audio)
   │
   ▼
deliver ── presencia + espera ──> uazapi /message/presence
   │ envío ──> uazapi /send/* ──> id de WhatsApp (messageid)
   │ onResult
   ▼
ConversationRecorder.recordOutbound (estado «enviado», id de WhatsApp) ──> Neon
                                                                             │ updated_at
WhatsApp ──> uazapi aviso messages_update (Delivered / Read)                 │
   ──> /webhooks/uazapi ──> applyReceipts ──> markDelivery (solo avanza) ────┤
                                                                             ▼
bandeja web ── cada 1,5–4 s: /conversations/:id/live?since=<marca> ──> nuevos y cambiados
```

## Reglas

- **Solo avanza.** Los avisos llegan desordenados: un «entregado» que llega después del «leído» no lo baja.
- **Solo lo de ese número.** Un aviso marca mensajes salientes con ese id de WhatsApp en la conexión verificada por su token; no depende de `IsFromMe` (los avisos del propio teléfono traen ids de mensajes del cliente y no coinciden con nada).
- **Aviso antes de tiempo.** Si un aviso llega antes de que su mensaje quede guardado, se reintenta a los 1,5 s y a los 5 s.
- **La marca es opaca.** `cursor` es el `updated_at` de PostgreSQL como texto: la web lo devuelve tal cual (codificado en la URL).
- **Presencia, un detalle.** Si falla, el mensaje igual sale.
- **Fotos de perfil (como Leona).** Al escribir un cliente, si su foto no se revisó en el último día, se pide a uazapi (`POST /chat/avatar`, miniatura) y se guarda en `contacts.avatar_url` (`027_profile_pictures.sql`, `ContactAvatarService`). Son enlaces TEMPORALES de WhatsApp: si uno vence, la bandeja muestra las iniciales (`Avatar`). Sin foto se guarda vacía; si uazapi falla, se reintenta otro día. La foto del número conectado llega con su estado (`instance.profilePicUrl`) y se guarda en `whatsapp_connections.profile_picture_url`.

## Consumo

Cada mensaje del bot genera hasta tres avisos de uazapi (enviado, entregado, leído) y cada chat abierto consulta cada 1,5–4 s mientras la pestaña está a la vista. En el plan Hobby de Vercel (1 millón de invocaciones al mes) alcanza de sobra para pruebas.

## Herramientas del chat (fase 1)

`038_chat_tools.sql` · `domains/conversations/application/AgentReply.ts` · `domains/quick-replies` · `apps/web/src/features/conversations/components/composer/`

| Qué | Cómo funciona |
|---|---|
| **Responder con varias piezas** | `POST /conversations/:id/messages` acepta `{ text }` o `{ parts, replyToId }`. Cada parte es un texto o un archivo (foto, video, audio o documento, con leyenda) y salen en orden. `AgentReply.parseAgentReply` valida lo que llega del navegador: hasta 10 partes, solo enlaces https y textos de hasta 4096 caracteres. |
| **Archivos y notas de voz** | La web los sube con `/media` (los bytes no pasan por la API) y envía su enlace. Una nota grabada en el chat lleva `voice: true` y uazapi la entrega como `ptt` (nota de voz). El navegador graba en ogg/opus o mp4/aac, que WhatsApp acepta; si no puede, se avisa. `vercel.json` permite el micrófono solo a la propia app (`microphone=(self)`). |
| **Citar un mensaje** | `replyToId` es un mensaje del mismo chat. Se envía a WhatsApp con su id (`replyid`) y se guarda en `conversation_messages.reply_to_id`. El hilo devuelve `replyTo` (autor, tipo y texto) para mostrar la cita en la burbuja. |
| **Reaccionar** | `POST /conversations/:id/messages/:mid/reaction { emoji }`. Si el emoji va vacío, se quita la reacción. Sale como reacción de WhatsApp y se guarda como mensaje `reaction` con `reply_to_id`. La web (`threadView`) la muestra sobre su mensaje: manda la última. No pausa el bot. |
| **Eliminar un chat** | `DELETE /conversations/:id` borra el chat y sus mensajes (`on delete cascade`). Requiere `conversations.manage`, que tienen dueños y administradores. El cliente sigue en Contactos y en Ventas; si vuelve a escribir, empieza un chat nuevo. La bandeja devuelve `canManage` para mostrar el botón solo a quien puede usarlo. |
| **Respuestas rápidas** | Ver `domains/quick-replies/README.md`. |

Web: `ChatView` coordina y delega en `ChatHeader`, `ChatThread`, `MessageBubble` (con `MessageActions` y `QuotedMessage`) y `composer/Composer`. `Composer` usa `ComposerTools`, `PendingPieces`, `useDraftPieces`, `useVoiceRecorder`, `EmojiPicker`, `QuickReplyPicker` y `QuickReplyEditor`.
