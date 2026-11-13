# Datos del negocio

**Configuración › Datos › Datos del negocio** (`/settings/business-data`): lo que se repite en los mensajes de la cuenta (Pago Móvil, horario, dirección, enlaces) escrito una vez y usado como `{g_clave}`.

| Pieza | Dónde vive |
|---|---|
| Contrato | `contracts/BusinessDataContracts.ts` (tipos, límites, `fillBusinessData`, `businessValuesOf`) |
| Dominio | `domains/business-data` (`domain/BusinessDatum.ts`: reglas · `domain/businessDataUses.ts`: dónde se usa · `application/BusinessDataServices.ts`) |
| Base | `infrastructure/persistence/sql/SqlBusinessData.ts` (repositorio y valores para el motor) · `SqlBusinessDataTexts.ts` (difusiones y respuestas rápidas) · migración `052_business_data.sql` |
| Motor | `flow-engine/ports/BusinessDataReader.ts` · `ExecutionOrchestrator` (una lectura por turno) · `templateResolver` · `evaluateCondition` |
| API | `apps/api/routes/routeBusinessDataRequest.ts` · `composition/composeBusinessDataServices.ts` |
| Web | `apps/web/src/features/business-data` (Configuración) · `apps/web/src/shared/business-data` (API y valores: los usan el editor, el chat y las difusiones) · `builder/tools/conditional/BusinessDataRule.tsx` |

## Lo que da valor

En Leona las variables globales son una lista de nombres con un valor inicial que los flujos pueden cambiar. Auream:

- **No deja que un flujo los cambie:** un valor que cambian varios chats a la vez se presta a errores. Solo se cambian en Configuración (`flows.write`).
- **Dice dónde se usa cada uno:** bloques de flujos (textos y reglas del Condicional), difusiones por enviar y respuestas rápidas, con enlace.
- **«Así lo ve tu cliente»:** un mensaje real que lo usa, con el valor resaltado, que cambia mientras se escribe el valor nuevo.
- **Tipo de verdad** (texto, número, fecha, sí o no): la regla «Variable global» del Condicional compara con su tipo, igual que un campo del cliente.
- **Mismo prefijo `g_` que Leona:** un flujo traído de allá funciona al crear el dato.

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
- **MCP:** `list_flow_resources` devuelve `businessData`, y la guía de bloques explica `{g_…}` y la regla `globalVariable`.

## API

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/business-data` | `flows.read` (con usos y ejemplo) |
| GET | `/business-data/values` | `flows.read` o `conversations.read` (solo valores) |
| POST | `/business-data` | `flows.write` |
| PATCH | `/business-data/:id` | `flows.write` |
| DELETE | `/business-data/:id?confirm=<clave>` | `flows.write` (la clave, si algo lo usa) |

## Pruebas

- `tests/unit/businessData.test.ts`: reglas, motor, Condicional, difusiones, respuestas rápidas, usos y la memoria de valores.
- `tests/security/routeBusinessData.test.ts`: permisos por rol y aislamiento entre cuentas.
- `tests/integration/businessDataPersistence.test.ts`: tabla y reglas de la base, textos de difusiones y respuestas rápidas.
- `apps/web/tests/components/BusinessDataSettings.test.tsx` y `ConditionBusinessData.test.tsx`.

## Después (entrega B)

- **Cambio programado:** otro valor entre dos fechas que vuelve solo al de siempre (p. ej. el horario de Navidad).
- **Historial:** quién cambió qué y cuándo (`updated_by` ya se guarda).
