# Datos del negocio

**Configuración › Datos › Datos del negocio** (`/settings/business-data`): lo que les dices igual a todos tus clientes (horario, dirección, link de pago, enlaces) escrito una vez y usado como `{g_clave}`. Entrega A: el catálogo. Entrega B: **cambios programados** e **historial**.

| Pieza | Dónde vive |
|---|---|
| Contrato | `contracts/BusinessDataContracts.ts` (tipos, límites, `fillBusinessData`, `businessValuesOf`) · `contracts/BusinessDataTimeline.ts` (programados, historial, `valueAt`) |
| Dominio | `domains/business-data` (`domain/BusinessDatum.ts`: reglas · `domain/DatumSchedule.ts`: reglas de un programado · `domain/datumChanges.ts`: líneas del historial · `domain/businessDataUses.ts`: dónde se usa · `application/BusinessDataServices.ts` y `application/BusinessDataTimeline.ts`) |
| Base | `infrastructure/persistence/sql/SqlBusinessData.ts` (repositorio y valores para el motor) · `SqlBusinessDataTimeline.ts` (programados e historial) · `SqlBusinessDataTexts.ts` (difusiones y respuestas rápidas) · migraciones `052_business_data.sql` y `054_business_data_timeline.sql` |
| Motor | `flow-engine/ports/BusinessDataReader.ts` · `ExecutionOrchestrator` (una lectura por turno) · `templateResolver` · `evaluateCondition` |
| API | `apps/api/routes/routeBusinessDataRequest.ts` · `composition/composeBusinessDataServices.ts` |
| Web | `apps/web/src/features/business-data` (Configuración: lista, detalle en pestañas, `schedules/`, `history/`) · `apps/web/src/shared/business-data` (API y valores: los usan el editor, el chat y las difusiones) · `apps/web/src/shared/ui/how-it-works` («Cómo funciona», también en Campos del cliente) · `builder/tools/conditional/BusinessDataRule.tsx` |

## Lo que da valor

En Leona las variables globales son una lista de nombres con un valor inicial que los flujos pueden cambiar. Auream:

- **No deja que un flujo los cambie:** un valor que cambian varios chats a la vez se presta a errores. Solo se cambian en Configuración (`flows.write`).
- **Dice dónde se usa cada uno:** bloques de flujos (textos y reglas del Condicional), difusiones por enviar y respuestas rápidas, con enlace.
- **«Así lo ve tu cliente»:** un mensaje real que lo usa, con el valor resaltado, que cambia mientras se escribe el valor nuevo.
- **Tipo de verdad** (texto, número, fecha, sí o no): la regla «Variable global» del Condicional compara con su tipo, igual que un campo del cliente.
- **Mismo prefijo `g_` que Leona:** un flujo traído de allá funciona al crear el dato.
- **Cambio programado** (Leona no lo tiene): otro valor entre dos fechas que entra y sale solo, igual en todo lo que lee `{g_…}`.
- **Historial** con quién y «Volver a este valor».
- **«Cómo funciona»** arriba (y en Campos del cliente): qué es, tres pasos con dibujo, y el enlace a la otra pantalla. Se cierra con «Entendido» (se recuerda en el navegador) y queda abierto mientras no haya datos. Los ejemplos sirven a cualquier negocio de cualquier país.

## Modelo

- `business_data`: `(tenant_id, key)` único; `key` `^g_[a-z0-9_]{1,40}$`; `label` 1–40; `type` texto, número, fecha o sí o no (sin lista); `value` 1–1000; `description` ≤ 140; `updated_by` es texto (la clave de desarrollo no es un uuid).
- **El valor se guarda «a lo computador»:** número `1200000`, sí o no `true`, fecha `2026-12-24`. A una persona se le muestra como «1.200.000», «Sí», «24/12/2026». Un número con letras se rechaza («8 a 6» no es 86).
- **La clave no cambia** después de creada: los mensajes la usan.
- Hasta 100 por cuenta. **Los precios no van aquí:** viven en Productos.
- Un campo del cliente no puede empezar por `g_` (nunca se leería).

## Cómo llega a cada mensaje

- **Flujos (reales y laboratorio):** `ExecutionOrchestrator` lee los valores una vez por turno (`BusinessDataReader`) y los pasa en `RuntimeInput.business`. `templateResolver` resuelve `g_…` **solo** desde ahí: nunca de la conversación ni de la ficha. Si la lectura falla, el turno sigue y los textos quedan con su valor por defecto.
- **Memoria:** `SqlBusinessValues` guarda los valores 15 s por cuenta y los olvida en cuanto el servicio de la pantalla cambia uno en ese servidor. En otro servidor de Vercel el cambio llega a más tardar en 15 s.
- **Condicional:** la categoría `globalVariable` ya no es «no disponible»: usa los operadores con tipo (`operatorsForFieldType`). Si el motor no conoce los valores, la regla no se cumple y queda anotada (no se inventa).
- **Difusiones:** `personalize(text, persona, pie, business)` en el envío y en la prueba (`BroadcastEngine.business`).
- **Respuestas rápidas:** `quickReplyParts(reply, nombre, business)` en el MCP y `applyQuickReply(…, business)` en el chat de la web: salen con el valor puesto.
- **MCP:** `list_flow_resources` devuelve `businessData` con `value` (el de ahora), `usualValue` (el de siempre) y `scheduled`; la guía de bloques explica `{g_…}`, los programados y la regla `globalVariable` (en pantalla, «Dato del negocio»).

## API

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/business-data` | `flows.read` (con usos y ejemplo) |
| GET | `/business-data/values` | `flows.read` o `conversations.read` (solo valores) |
| POST | `/business-data` | `flows.write` |
| PATCH | `/business-data/:id` | `flows.write` |
| DELETE | `/business-data/:id?confirm=<clave>` | `flows.write` (la clave, si algo lo usa) |
| GET | `/business-data/:id/history` | `flows.read` (los últimos 50) |
| POST | `/business-data/:id/schedules` | `flows.write` (`{ value, from: {date,time}, until: {date,time}, note }`) |
| PATCH | `/business-data/:id/schedules/:sid` | `flows.write` |
| DELETE | `/business-data/:id/schedules/:sid` | `flows.write` (quita uno que no empezó; termina ya uno activo) |

## Cambio programado

- `business_data_schedules`: `value`, `starts_at` (incluido), `ends_at` (sin incluir), `note` ≤ 60, `created_by` (texto). **Sin tareas en la cola:** el valor del momento se decide al leer (`valueAt`). Terminar antes uno activo pone `ends_at = now`. Los terminados hace más de 90 días se borran al guardar (quedan en el historial).
- **Reglas** (`DatumSchedule.ts`): fechas en la zona de la **empresa** (`SqlTenantResolver`, igual que los mensajes programados); «desde» en el pasado es «desde ya»; «hasta» después, a lo sumo un año adelante; el valor con el tipo del dato y distinto del de siempre; sin cruces con otro del mismo dato (el servidor lo revisa otra vez con el dato bloqueado: dos personas a la vez reciben `overlap`); hasta 10 por venir o activos; uno activo se edita sin mover «desde»; uno terminado no se toca. Con programados no se cambia el tipo del dato.
- **Pantalla:** la lista muestra el valor de **ahora** con su etiqueta («Navidad · 24 → 26 dic · +1 más» o «Ahora: Promo · hasta el 15 nov» con «Siempre: …» debajo); el detalle tiene pestañas **Dato · Cambios programados · Historial**; «Así lo ve tu cliente» se mira ahora, siempre o durante cada cambio; cada tarjeta avisa de las difusiones programadas que saldrán durante el cambio (`BusinessDataUse.sendAt`). La hora se refresca cada minuto (`useMinute`).

## Historial

- `business_data_changes` por **clave** (sin llave al dato: si se borra y se crea otra vez, se ve su pasado): `kind` (`created`, `value`, `label`, `type`, `description`, `scheduled`, `rescheduled`, `unscheduled`, `ended`, `deleted`), `detail` (jsonb: antes y después o el programado), `value_type`, `actor_id` (texto; el nombre sale de `user_profiles`). Se escribe **en la misma transacción** que el cambio y se guardan los últimos 50 por clave.
- Guardar sin cambiar nada no escribe ni anota. «Volver a este valor» es un PATCH normal: queda como un cambio más.

## Pruebas

- `tests/unit/businessData.test.ts`: reglas, motor, Condicional, difusiones, respuestas rápidas, usos y la memoria de valores.
- `tests/unit/businessDataTimeline.test.ts`: bordes de hora y zona, cruces, límites, editar uno activo, terminar ya, historial y que el motor cambie justo a la hora.
- `tests/security/routeBusinessData.test.ts`: permisos por rol (también programar e historial) y aislamiento entre cuentas.
- `tests/integration/businessDataPersistence.test.ts`: tablas y reglas de la base, cruces con el dato bloqueado, nombre de quién, historial de 50 y textos de difusiones y respuestas rápidas.
- `apps/web/tests/components/BusinessDataSettings.test.tsx` («Cómo funciona» incluido), `BusinessDataTimeline.test.tsx` y `ConditionBusinessData.test.tsx`.
