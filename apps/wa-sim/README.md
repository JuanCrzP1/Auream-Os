# WhatsApp simulado

Un WhatsApp falso para probar Auream completo en tu máquina, sin números reales: hace de **servidor de uazapi** para Auream y trae un **teléfono de prueba** en el navegador para escribir como cliente.

Solo para desarrollo: no arranca en producción ni en Vercel, y nada sale a WhatsApp.

Arquitectura y decisiones: [docs/architecture/wa-simulator.md](../../docs/architecture/wa-simulator.md).

## Arrancar

En dos terminales:

```bash
# 1. El simulador (teléfono de prueba en http://localhost:3200)
npm run sim

# 2. Auream (API y web en http://localhost:5173) apuntando al simulador
WHATSAPP_SIMULATOR_URL=http://localhost:3200 npm run dev
```

También puedes dejar `WHATSAPP_SIMULATOR_URL=http://localhost:3200` en tu `.env` local. Con él, la API usa el simulador en lugar de `UAZAPI_BASE_URL`.

## Probar

1. **Conectar un número.** En Auream, ve a *Conexiones*, crea una conexión por QR y pide el código. En el teléfono de prueba aparece en *Números de la cuenta* como «Esperando el QR»: escribe un número de negocio (opcional) y toca **Escanear QR**. Auream la muestra conectada.
2. **Ser cliente.** En *Clientes de prueba* agrega un nombre y un número con país (p. ej. `573001112233`). Marca **Llega desde un anuncio** para probar los clientes de Meta Ads.
3. **Escribir.** Abre el chat y escribe. En Auream aparece en *Conversaciones*, entra al CRM según su configuración y corre el flujo del disparador.
4. **Responder desde Auream.** Lo que envíe Auream (texto, archivos, notas de voz, menús) aparece en el teléfono. Con el chat abierto se marca leído y Auream muestra los chulos azules.
5. **Menús del bot.** Toca una opción: responde como un botón o una lista de WhatsApp.
6. **Adelantar el tiempo.** Con el chat abierto, **⏩ Adelantar el tiempo** hace que corra ya lo que el flujo esperaba: un Programador («espera 3 minutos», «el lunes a las 8»), el «Tiempo agotado» de Esperar respuesta o Menú, o una pausa de un Mensaje. Dice hasta cuándo iba a esperar. Así se prueban los recordatorios de 2 h o 48 h en segundos.
7. **Ver lo que pasó.** El botón de arriba muestra lo que Auream pidió y cada aviso enviado, con sus errores.

**Empezar de cero** borra números, clientes y mensajes del simulador; en Auream hay que volver a conectar.

## Configuración

| Variable | Por defecto | Para qué |
|---|---|---|
| `SIM_PORT` | `3200` | Puerto del simulador y del teléfono. |
| `SIM_ADMIN_TOKEN` | `simulador` | Token de administrador (el de uazapi). Debe coincidir con `WHATSAPP_SIMULATOR_TOKEN` de la API. |
| `SIM_WEBHOOK_URL` | `http://localhost:3100/webhooks/uazapi` | Dónde avisar si Auream no registró su dirección. |
| `SIM_DATA_DIR` | `data/wa-sim` | Estado (`state.json`) y archivos subidos. Ignorado por git. |

En la API: `WHATSAPP_SIMULATOR_URL` (solo `http://localhost` o `127.0.0.1`) y `WHATSAPP_SIMULATOR_TOKEN` (por defecto `simulador`).

## Qué imita

| uazapi | En el simulador |
|---|---|
| `/instance/create`, `connect`, `status`, `disconnect`, `reset`, `DELETE /instance` | Números con QR, «escanear» desde el teléfono, sesión que sobrevive a reinicios. |
| `/webhook` | Guarda la dirección y los eventos que pide Auream; solo avisa esos. |
| `/send/text`, `/send/media` (imagen, video, audio, nota de voz, documento), `/send/menu` (botones y listas) | Llega al teléfono; ✓ al enviar, ✓✓ a los 0,7 s, azul al abrir el chat. |
| `/message/react`, `/message/presence`, `/message/download` | Reacciones, «escribiendo…» / «grabando audio…», descarga de archivos del cliente. |
| `/group/*` | Crear, listar, cambiar nombre, descripción, foto y permisos; enlace de invitación; avisos de quién entra y sale. |
| — (solo del simulador) | **Adelantar el tiempo**: `POST /_sim/chats/:instance/:phone/advance` → Auream `POST /dev/simulator/advance`. |
| Avisos `connection`, `messages`, `messages_update`, `groups` | Mismo formato que uazapi, incluido el origen de anuncio (`externalAdReply`). |

## Pruebas

```bash
npx vitest run tests/contract/waSimulatorContract.test.ts
```

Usa el cliente y los parsers **reales** de uazapi de Auream contra el simulador. Si falla, el simulador y Auream ya no hablan igual.

## Agregar algo que haga uazapi

1. El endpoint, en `provider/` (el archivo de su tema; cada archivo hasta 200 líneas).
2. La regla, en `core/Simulator.ts`; el aviso nuevo, en `webhooks/uazapiEvents.ts`.
3. Lo que haga el cliente, en `phone/phoneApi.ts` y `phone/ui/`.
4. Un caso en la prueba de contrato con el cliente o parser real de Auream.
