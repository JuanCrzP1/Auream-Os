# WhatsApp simulado (herramienta de desarrollo)

`apps/wa-sim` · `apps/api/config/loadWhatsAppSimulator.ts` · `tests/contract/waSimulatorContract.test.ts`

## Qué resuelve

Para probar Auream de punta a punta (conexiones, chats, flujos, CRM, grupos) hacía falta un WhatsApp de verdad: un número real, un segundo teléfono como cliente y los avisos de uazapi llegando a una dirección pública. Así no se puede probar a diario, ni en local, ni con muchos clientes a la vez, ni de forma repetible.

El simulador es **un uazapi falso que corre en tu máquina**: Auream le habla con su cliente real de uazapi, y el simulador responde y avisa exactamente como uazapi. Al lado trae un **teléfono de prueba** en el navegador para hacer de cliente. Las grandes plataformas de mensajería ofrecen lo mismo (sandboxes y números de prueba) por esta razón.

Nada sale a WhatsApp: no hay números reales, ni costos, ni riesgo de bloqueo.

## Dónde vive y por qué

- **Fuera de los dominios.** Es una app aparte (`apps/wa-sim`), como `apps/api` y `apps/web`. Ningún dominio sabe que existe.
- **Auream no cambia de código.** Solo cambia la dirección del proveedor: con `WHATSAPP_SIMULATOR_URL`, la configuración (`loadApiConfig`) usa el simulador como si fuera el servidor de uazapi. Todo lo demás (`UazapiClient`, `UazapiLinker`, los parsers de avisos, el motor de flujos) es el código real.
- **Nunca en producción.** El simulador no arranca con `NODE_ENV=production` ni en Vercel, y la API rechaza `WHATSAPP_SIMULATOR_URL` en producción y cualquier dirección que no sea `localhost` o `127.0.0.1`.

## Piezas

| Carpeta | Responsabilidad | No sabe de |
|---|---|---|
| `core/` | El estado del WhatsApp falso (números, clientes, mensajes, grupos, registro) y sus reglas: vincular por QR, entregar (✓✓ a los 0,7 s), leer, reaccionar. Se guarda en `data/wa-sim/state.json` y sobrevive a reinicios. | HTTP, Auream |
| `webhooks/` | Traduce lo que pasa en el simulador al **formato de aviso de uazapi** (`connection`, `messages`, `messages_update`, `groups`) y se lo envía a Auream, solo los eventos que Auream pidió. | cómo se guardan los datos |
| `provider/` | La **API de uazapi** que usa Auream: números (`/instance/*`, `/webhook`), mensajes (`/send/text`, `/send/media`, `/send/menu`, `/message/*`) y grupos (`/group/*`). Con sus mismos tokens y errores (401, 503). | el teléfono de prueba |
| `phone/` | El **teléfono de prueba**: su API (`/_sim/*`), los archivos que sube el «cliente» y la página (`phone/ui`). | uazapi |
| `http/` | Enrutador mínimo, lectura de JSON con límite de tamaño. | — |
| `config.ts`, `server.ts`, `main.ts` | Configuración (rechaza producción), armado y arranque. | — |

## Recorrido

```
  Teléfono de prueba (navegador, :3200)
        │  el «cliente» escribe, toca un botón, manda una foto
        ▼
  phone/phoneApi ──> core/Simulator ──> webhooks/AureamNotifier ──> Auream API /webhooks/uazapi
                                                                        │
                                       (parsers reales de uazapi, motor de flujos, bandeja, CRM)
                                                                        │
  core/Simulator <── provider/messageApi <── UazapiClient real (/send/text, /send/menu…)
        │
        └──> recibo «entregado» y, al abrir el chat, «leído» ──> Auream (chulos azules)
```

## El contrato

`tests/contract/waSimulatorContract.test.ts` levanta el simulador y lo usa con el **cliente real** de uazapi de Auream y sus **parsers reales**: crear, QR, escanear, enviar, recibos, botones, anuncios, archivos, notas de voz, reacciones y grupos. Si el simulador se aleja de cómo habla uazapi, o Auream cambia lo que espera, esta prueba falla. Cuando uazapi cambie algo, se ajustan juntos el parser de Auream y el simulador.

## Adelantar el tiempo

Los flujos esperan de verdad (Programador, «Tiempo agotado», pausas): el motor declara cuándo despertar y la cola de tareas lo despierta (ver `task-queue.md`). Para probar un recordatorio de 48 h sin esperar 48 h:

```
Teléfono de prueba ── POST /_sim/chats/:instance/:phone/advance
        │
        ▼
  webhooks/AureamClock ── POST /dev/simulator/advance { connectionId, token, phone }
        │                     (misma dirección donde llegan los avisos)
        ▼
  routeSimulatorTools ── composeSimulatorTools
        │   el token del número lo autoriza (como un aviso de uazapi): solo chats de ESE número
        ▼
  TaskScheduler.advanceGroup(cuenta, conversation:<conexión>:<teléfono>)
        │   lo pendiente del chat vence YA (`TaskRepository.advanceGroup`) y despierta al trabajador
        ▼
  FlowTimerService.fire ── el bloque recibe su despertador y sigue (o sale por «Tiempo agotado»)
```

- **No cambia el reloj de nadie.** Solo adelanta la hora de las tareas de ese chat; los bloques reaccionan al despertador, no comparan relojes, y el motor descarta los vencidos (nunca duplica).
- **Solo con el simulador.** `/dev/simulator/advance` no existe si la API no tiene `WHATSAPP_SIMULATOR_URL`, y la configuración rechaza esa variable en producción.
- Pruebas: `tests/unit/simulatorAdvance.test.ts` (ruta, token, solo ese chat), `tests/integration/taskQueuePersistence.test.ts` (SQL) y el contrato del simulador.

## Lo que ya encontró

- **Dos QR a la vez dejaban un número huérfano.** Dos pedidos de vinculación casi simultáneos creaban dos instancias en uazapi (con 4 ms de diferencia). Ahora la sesión nueva se guarda solo si nadie se adelantó (`ConnectionRepository.saveIfSession`); el pedido que pierde borra la suya y muestra el QR del ganador (`LinkConnectionService`, prueba `connectionLinkRace.test.ts`).

## Límites (a propósito)

- No imita la red de WhatsApp: no hay bloqueos, límites de envío ni números que no existen.
- Los archivos del «cliente» se sirven por `http://localhost`; Auream los pide por `/message/download`, como con un aviso real sin enlace.
- Los perfiles no tienen foto.

## Lo que sigue

1. **Recorridos automáticos** (`npm run test:e2e`): escenarios de punta a punta con informe, y datos de demostración para empezar en segundos.
