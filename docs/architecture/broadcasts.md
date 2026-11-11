# Difusiones

**Difusiones** (`/broadcasts`): un flujo o un mensaje a muchos clientes que **ya escribieron**, sin poner en riesgo el número, y con lo que vendió cada difusión.

| Pieza | Dónde vive |
|---|---|
| Dominio | [`domains/broadcasts`](../../domains/broadcasts/README.md) |
| Envío y bandeja | `domains/messaging/application/OutreachService.ts` |
| Web | `apps/web/src/features/broadcasts` |

## Lo que da valor

- **Del envío a la venta.** Las herramientas de difusión suelen llegar hasta «leídos» y «respondieron». Auream ya registra la venta en el chat, así que cada difusión muestra cuánto vendió.
- **Cuidar el número.** Un número por QR que manda cientos de mensajes iguales, seguidos, a gente que nunca escribió, termina bloqueado. Todo el diseño evita eso.

## Crear (4 pasos)

1. **Qué enviar.**
   - Un flujo (empieza desde su primer bloque, como si el cliente escribiera), o un mensaje con foto o video.
   - `{first_name}` pone el nombre del cliente. Si no se sabe, no deja un hueco: «Hola 👋».
   - De 1 a 3 versiones.
   - «Enviarme una prueba» la manda al WhatsApp de quien la arma.
2. **A quién.**
   - Siempre gente que ya escribió por alguno de los números elegidos.
   - Filtros:
     - Etiquetas y etapas del CRM. Cada etapa es una etiqueta. Un toque incluye, otro excluye.
     - País, por el prefijo del número.
     - «Escribió en los últimos N días».
     - «Sin compras en los últimos N días».
   - El número de personas se actualiza en vivo.
   - Las audiencias se pueden guardar con un nombre.
3. **Número y cuándo.**
   - Uno o varios números. Cada cliente la recibe por el número en que ya habla; si habla por dos, por el más reciente.
   - Ahora o programada.
   - Ritmo, tope diario, horario y el pie «responde SALIR».
   - Por la API oficial no se puede todavía: escribir primero exige plantillas aprobadas por Meta (fase siguiente).
4. **Revisar.**
   - Nombre.
   - Prueba A/B (con 2 o más versiones).
   - Segundo envío a los que no respondieron.

## Envío seguro

| Regla | Detalle |
|---|---|
| Solo a quien ya escribió | La audiencia sale de los mensajes entrantes de la bandeja |
| Pausas al azar | Normal: 8 a 25 s. Prudente: 20 a 45 s. Nunca un patrón fijo |
| Horario | Solo entre las horas elegidas, con el reloj del negocio. Fuera de ese horario, la cadena sigue cuando abre |
| Tope diario por número | Cuenta lo de todas las difusiones (300 por defecto, de 20 a 1000) |
| Calentamiento | Los primeros 7 días con difusiones, el tope de cada número es 20, 40, 60, 100, 150, 200 y 250. No sube a mitad del día |
| Versiones | Sin prueba A/B, cada persona recibe una al azar: no salen cientos de mensajes idénticos |
| «SALIR» | «SALIR», «stop», «no quiero más» o «sácame de la lista» sacan al cliente de **todas** las difusiones (`broadcast_opt_outs`) |
| Se pausa sola | Con más del 5 % de fallos (después de 20 intentos), si el número se desconecta o si el flujo se borra o archiva. Lleva el motivo |

## Cómo corre (cola de tareas)

```
crear ──> broadcast.start (a su hora; si es «ahora», también en el momento)
            │ arma la lista: barajada, con su versión, sin duplicados
            ▼
   una cadena por número: broadcast.tick ──envía a 1──> broadcast.tick (pausa al azar) …
            │ fuera de horario o tope lleno: el siguiente eslabón queda para cuando abra
            ▼ sin pendientes en ningún número
   ┌─ prueba A/B sin decidir ─> testing ─> broadcast.decide (N horas) ─> la ganadora al resto ─> sending
   └─ done ─> broadcast.follow_up (N horas) ─> otra difusión (`parent_id`) solo a quien no respondió
```

- **Una sola cadena por número.** Cada eslabón reemplaza al pendiente de su grupo (`broadcast:<id>:<número>`): pausar y seguir nunca duplica el ritmo.
- **Idempotente.**
  - Tomar el siguiente es atómico (`for update skip locked`).
  - Un cliente no entra dos veces a la misma difusión (`unique (broadcast_id, phone)`).
  - Hay un solo segundo envío por difusión (índice único en `parent_id`).
  - Los cambios de estado son condicionales.
- **Sin duplicar mensajes.** Un envío que quedó «enviando» más de 5 minutos (el proceso murió) se marca como fallido y no se reintenta.
- Lo que vence en segundos despierta ya al trabajador. Lo demás usa el despertador de Vercel Queues (ver [task-queue.md](task-queue.md)).

## Resultados

No se copian. Se leen de donde viven, así que siempre están al día (`SqlBroadcastResults`):

| Dato | De dónde |
|---|---|
| Entregado y leído | El aviso de WhatsApp del primer mensaje (`provider_message_id` en la bandeja). Si respondió, también cuenta como leído |
| Respondió | Un mensaje del cliente en ese chat después del envío |
| Compró | Una venta aprobada del cliente dentro de los **3 días** siguientes. Cuenta solo para la **última** difusión que recibió antes de comprar, para no contarla dos veces |
| No quiere más | Pidió salir después de recibirla |

- **La prueba A/B** gana por ventas por envío. Si empatan, decide la plata y después las respuestas.
- **El segundo envío** va solo a quien recibió la difusión y no respondió, ni compró, ni pidió salir.

## Permisos

| | Dueño | Administrador | Asesor | Solo lectura |
|---|---|---|---|---|
| Ver difusiones y resultados (`broadcasts.read`) | ✓ | ✓ | ✓ | ✓ |
| Crear, pausar, seguir, cancelar, probar, audiencias (`broadcasts.manage`) | ✓ | ✓ | — | — |

## API

| Ruta | Permiso |
|---|---|
| `GET /broadcasts` · `GET /broadcasts/:id` · `GET /broadcasts/:id/recipients?filter&offset` | `broadcasts.read` |
| `POST /broadcasts` · `POST /broadcasts/:id/pause\|resume\|cancel` · `POST /broadcasts/test` | `broadcasts.manage` |
| `POST /broadcasts/audience/preview` · `GET\|POST /broadcasts/audiences` · `DELETE /broadcasts/audiences/:id` | `broadcasts.manage` |

## Datos

`034_broadcasts.sql` es aditiva y crea:
- `broadcasts`
- `broadcast_recipients`
- `broadcast_opt_outs`
- `broadcast_audiences`

## Pruebas

**Backend:**
- `tests/unit/broadcastRules.test.ts`
- `tests/unit/broadcastEngine.test.ts`
- `tests/security/routeBroadcasts.test.ts`
- `tests/integration/broadcastsPersistence.test.ts` (PostgreSQL real)

**Web:**
- `apps/web/tests/components/BroadcastsPage.test.tsx`

## Después

- Cupo por plan, con los pagos.
- Plantillas de la API oficial, para enviar por esos números.
- Recordatorios de seguimientos del CRM por WhatsApp.
- Difusiones recurrentes.
