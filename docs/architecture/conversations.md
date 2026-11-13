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
| **Respuestas rápidas** | Se organizan en Configuración › Respuestas rápidas, con categorías, uso, duplicar y vista previa (dueños y administradores, `conversations.manage`). En el chat solo se buscan y se envían. Ver `domains/quick-replies/README.md`. |

Web: `ChatView` coordina y delega en `ChatHeader`, `ChatThread`, `MessageBubble` (con `MessageActions` y `QuotedMessage`) y `composer/Composer`. `Composer` usa `ComposerTools`, `PendingPieces`, `useDraftPieces`, `useVoiceRecorder` (con `VoiceRecordingBar`), `EmojiPicker` y `QuickReplyPicker`. La página de Configuración y el editor viven en `features/conversations/quick-replies/`.

## Atención de los chats (fase 2)

`040_chat_attention.sql` · `domains/conversations/domain/ChatStatus.ts` · `ChatAttention.ts` · `NewChatService.ts` · `domains/crm/application/DealOwnerClaims.ts` · `domains/contacts/application/ContactNoteServices.ts`

| Estado | Cuándo |
|---|---|
| **Con bot** (`bot`) | El bot atiende. Se llega al activar el bot o al ejecutar un flujo. |
| **En espera** (`waiting`) | El bot está en pausa y nadie tomó el chat. |
| **En atención** (`attending`) | Un asesor lo tomó (`assignee_id`). Responder también lo toma, si no tenía responsable. |
| **Resuelto** (`resolved`) | Un asesor lo cerró. El bot vuelve a atender; si el cliente escribe, el chat se reabre como «Con bot». |

- **Sin responder** (`awaiting_since`): se marca con el primer mensaje del cliente sin contestar y se borra cuando el bot o un asesor le responden. Un envío fallido no cuenta como respuesta. La bandeja muestra cuánto lleva esperando, en rojo desde los 15 minutos (`AWAITING_ALERT_MINUTES`), solo en chats que atiende una persona.
- **Responsable compartido con el CRM**: al tomar o pasar un chat, los negocios del cliente **sin** responsable quedan con esa persona (`DealOwnerClaims`), y queda anotado en su historial. Los que ya tenían responsable no cambian.
- **Pestañas y filtros**: `GET /conversations` admite `status`, `filter=mine|unanswered` y `assigneeId` (o `none`), y devuelve cuántos chats hay en cada estado (`counts`) y `canWrite`.
- **Rutas**:
  - `POST /conversations/:id/take|assign|resolve` y `POST /conversations` (chat nuevo) piden `conversations.write`.
  - `GET /conversations/agents` lista quién puede atender (todo el equipo menos los de solo lectura).
- **Chat nuevo**:
  - Sale de un número **conectado** de la cuenta. El cliente queda en Contactos, y si ya tenía chat por ese número se abre el mismo.
  - El primer mensaje lo envía el asesor (el chat queda a su nombre) o un flujo (lo atiende el bot).
- **Notas internas**:
  - Rutas `/contacts/:id/notes`: verlas pide `contacts.read`; anotar, `contacts.write`.
  - Las borra quien la escribió, o un dueño o administrador.
  - El cliente no las ve.

Web:
- La bandeja: `list/InboxTabs`, `list/ConversationRow` (estado, responsable y espera), `list/ActivePills` y `new-chat/NewChatDialog`.
- La cabecera: `header/ChatHeader` con `header/HeaderLabels` (las etiquetas que caben y «+N») y `header/AttentionControls` (el estado abre «Pasar a…», «Dejar sin asignar», el bot y «Resolver»; al lado, «Tomar chat» o «Resolver»).
- La info del contacto: `info/LabelsSection` e `info/NotesSection`.
- Las acciones del chat abierto: `chatActions.ts`. Los menús usan `FloatingMenu`.

## Fase 3

### Registrar venta desde el chat

- Botón con etiqueta de precio en el encabezado (junto a Ejecutar flujo) y en Info. del contacto, si `GET /products` dice `canRecordSales`.
- `components/dialogs/ChatDialogs` junta los diálogos del chat (ejecutar flujo y registrar venta) con un solo estado; usa `RecordSaleDialog` de `shared/sales` con el chat (`conversationId`). No pide teléfono y propone el país por el indicativo (y con él, el precio).
- La venta se amarra al cliente y a su anuncio en el servidor (ver [`sales.md`](sales.md)). El chat avisa cómo quedó (aprobada, por revisar, si cuenta para un anuncio).

### Anuncio de origen

- **Qué se guarda.** Al llegar por un anuncio de clic a WhatsApp (`externalAdReply` o `referral`), la ficha del contacto (`contacts.ad_origin`) guarda el id, los enlaces, la miniatura, el código de clic y, desde ahora, el **título**, el **texto** y **cuándo llegó** (`receivedAt`, lo pone `ContactDirectoryService`; el mismo anuncio conserva la primera fecha). Los campos nuevos son opcionales: los anuncios guardados antes siguen valiendo.
- **En la lista.** `fromAd` en el resumen (`ad_origin is not null`) da la marca «Anuncio» en la fila y el filtro `from_ad` («Por anuncio»). La lista no trae el detalle, para seguir liviana.
- **El detalle.** `GET /conversations/:id/ad` (`conversations.read`) → `ChatAdOriginService` + `SqlChatAdOrigin`: lo que trajo el mensaje y, si el anuncio está sincronizado de una cuenta de Meta conectada (la misma regla que «por anuncio» en el Dashboard), su nombre, campaña, estado y miniatura oficial. Se pide solo al abrir Info. del contacto (`AdOriginSection`).
- **Seguridad.** Los datos del anuncio vienen dentro del mensaje y un cliente con una app modificada puede inventarlos. Solo pasan enlaces `https://`, que se abren con `noopener noreferrer`; la miniatura va sin referer. El código de clic (`ctwa_clid`) nunca sale. `connected: false` avisa que el anuncio no es de tus cuentas.

### Programar mensajes

- **Dónde vive.** Tabla propia `scheduled_messages` (`046_scheduled_messages.sql`): las piezas (igual que una respuesta del asesor), `send_at`, `cancel_if_replied`, `armed_at` (cuándo se programó o editó), el autor y cómo terminó. La cola genérica (`scheduled_tasks`, ver [`task-queue.md`](task-queue.md)) solo **despierta a la hora**: tarea `chat.scheduled_message` con clave `id + hora`. Si lo reprograman se arma otra; la vieja suena y no hace nada porque el despachador mira la hora guardada. Las tareas se borran a los 7 días y no saben de chats: por eso la tabla aparte.
- **La hora es la del negocio.** La web manda `{ date, time }` y el servidor la lee en la zona de Empresa (`resolveSendAt`, con `zonedToInstant`). Va de 1 minuto a 90 días, con hasta 20 pendientes por chat. La web hace la misma revisión antes (`scheduleModel.whenProblem`).
- **Enviar** (`ScheduledMessageDispatcher`). Lo toma de forma atómica (`pending → sending`, un `update … where status = any(…)`) y lo envía por el número del chat con `toOutbound`. Queda en el hilo como mensaje del asesor que lo programó (`recordOutbound`). **No toma el chat ni pausa el bot**: un recordatorio no cambia quién atiende.
  - Si **nada** salió (número desconectado), queda `failed` con el motivo, sin ensuciar el hilo.
  - Si falla **antes** de enviar (base caída), vuelve a como estaba y la cola reintenta.
  - Si falla **durante** el envío, queda `failed` («revisa el chat antes de reintentar») en vez de arriesgar un duplicado.
  - Un `sending` de más de 2 minutos se marca fallido.
- **«No enviar si el cliente responde antes».** Se revisa al momento de enviar: si el último mensaje del cliente es posterior a `armed_at`, queda `skipped`. No hace falta escuchar los mensajes entrantes. «Enviar ahora», «Reintentar» y «Enviar igual» lo ignoran.
- **API.** `GET|POST /conversations/:id/scheduled`, `PATCH|DELETE …/:sid` y `POST …/:sid/send` (`routeScheduledMessagesRequest`). Ver necesita `conversations.read` y cambiar, `conversations.write`. Cada respuesta trae los abiertos del chat con la zona del negocio. Un id de otro chat u otra cuenta «no existe».
- **Bandeja.** El resumen trae `nextScheduledAt` (el próximo pendiente) y `scheduledIssue` (alguno no salió), que dan la marca «Programado» / «No salió» en la fila y el filtro `scheduled` («Con programados»). El chat abierto vuelve a pedir sus programados cuando esos dos cambian en el chat en vivo: cuando uno sale, desaparece la burbuja y aparece en el hilo sin recargar.
- **Web.** ⏰ junto a enviar (`SchedulePopover`, `WhenPicker`) con atajos en la hora del negocio. Las burbujas punteadas al final del hilo (`ScheduledBubbles`) ofrecen enviar ahora, editar (`EditScheduledDialog`) y cancelar con confirmación; las que no salieron, reintentar y descartar.

