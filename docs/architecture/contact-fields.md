# Campos del cliente

**Configuración › Campos y datos › Campos del cliente** (`/settings/data?tab=customer`): el catálogo de los datos que la cuenta guarda de cada cliente, con nombre, clave y **tipo**.

| Pieza | Dónde vive |
|---|---|
| Contrato | `contracts/ContactFieldContracts.ts` |
| Dominio | `domains/contact-fields` (`domain/`: reglas puras · `application/`: servicio y paso al cliente) |
| Base | `infrastructure/persistence/sql/SqlContactFields.ts` · migración `049_contact_fields.sql` |
| API | `apps/api/routes/routeContactFieldsRequest.ts` · `composition/composeContactFieldServices.ts`, `contactFieldTurns.ts` |
| Web | `apps/web/src/features/contact-fields` (Configuración) · `apps/web/src/shared/contact-fields` (catálogo, «Nuevo campo», tipos: lo comparten Configuración, el editor y el CRM) · `builder/tools/_kit/FieldPicker.tsx` (elegir el campo en un bloque) · `crm/contacts/components/fields` (la ficha) |

## Lo que da valor

En Leona los campos son una lista de nombres: lo que guarda un bloque se queda en la conversación y nadie sabe de dónde sale ni si se usa. Auream suma lo que importa para decidir:

- **Tipo de verdad** (texto, número, fecha, sí o no, lista): lo que guarda un bloque se convierte al tipo antes de llegar al cliente.
- **De dónde sale y quién lo usa:** qué bloques lo llenan y cuáles lo leen, con enlace al flujo.
- **Lleno en X de Y clientes.**
- **El primer día:** los datos que tus flujos ya guardan se proponen como campos, con el tipo que encaja con sus valores reales.
- **Borrar protegido:** hay que escribir la clave si hay datos o bloques que lo usan.

## Modelo

- `contact_field_definitions`: `(tenant_id, key)` único, `label` (1–40), `type`, `options` (jsonb, solo lista). La base repite las reglas del dominio (regex de la clave, tipos).
- **El valor no se mueve:** sigue en `contacts.custom_fields` (jsonb) con la misma clave. Definir un campo no cambia los flujos ni los datos.
- **La clave no cambia** después de creada: los flujos la usan (`{ciudad}`). Nombre, tipo y opciones sí.
- **Claves reservadas** (`RESERVED_FIELD_KEYS`): las del sistema (`first_name`, `phone`, `fecha`…) y las que usa el motor (`comprobante`, `venta`…). Los del sistema se muestran aparte, con candado.
- Hasta 100 campos por cuenta; una lista tiene 2–30 opciones.

## Lo que guarda un flujo pasa al cliente

`FlowTurn` recibe el `contextPatch` de cada turno y lo entrega a `TurnFields` en paralelo con la entrega de mensajes:

1. `ContactFieldSync.persist` toma solo las claves que son **campos definidos** (lo demás sigue solo en la conversación, como siempre).
2. Convierte cada valor con `coerceFieldValue`: número acepta `1.200,50` y `1,200.50`; fecha `13/11/2026` o `2026-11-13`; sí o no `sí/no/yes/true/1`; lista busca la opción sin tildes ni mayúsculas. **Lo que no encaja no se guarda** en el cliente.
3. Busca al cliente solo si hay algo que guardar (`directory.resolve`) y escribe con `custom_fields || valores`, sin tocar las demás claves.

Si guardar falla, el turno no se entera (igual que el historial interno).

## Cómo lo leen los flujos

- **Lo dicho en esta conversación manda; si no, la ficha** (`flow-engine/values/customFieldValue.ts`, lo usan los mensajes y el Condicional). La conversación empieza en blanco cada vez que un flujo arranca (`SessionService`), así que nunca es de otro día. Por eso, si el cliente responde algo que no encaja en el tipo («Cartagena» en una lista sin esa opción), el flujo usa lo que acaba de decir y no el dato viejo de la ficha.
- **Las mismas reglas de lectura en todas partes** (`contracts/FieldValues.ts`): guardar en la ficha, comparar en el Condicional y mostrar en la web usan `parseYesNo`, `parseFieldNumber`, `parseFieldDate` y `foldAnswer` (sin tildes, mayúsculas ni signos). Un año de dos cifras hasta 50 es 20xx y desde 51 es 19xx.
- **Se muestra como persona** (`fieldValueText`): «Sí»/«No», «13/11/1990». En mensajes, la ficha del CRM y el laboratorio del editor. A las máquinas (integración, Pixel, Registrar venta, Comprobante) les llega crudo (`TemplateEncoding` `raw`).

## Quién llena y quién lee (`fieldUses.ts`)

Se leen los borradores de los flujos no archivados (lo guardado es lo que corre):

- **Llenan:** Esperar respuesta (`targetKey`), Menú (`saveToField`), Integración (`responseMappings[].field`), IA (`responseVariable`).
- **Leen:** cualquier `{clave}` o `{clave|respaldo}` en el contenido o la configuración, y las reglas de Condicional de tipo «campo».
- **Técnicos:** las salidas de Comprobante, Registrar venta y los errores de IA, y claves con forma de id/url/estado/error. En el primer día quedan aparte y sin marcar.

## El primer día (`GET /contact-fields/discover`)

- Candidatas: las claves guardadas en clientes ∪ las que llenan los bloques, menos las definidas, las reservadas, las internas (`__…`) y las que no cumplen el formato de clave.
- Tipo propuesto con los 40 valores más frecuentes: sí o no → fecha → número → lista (2–12 opciones agrupadas sin tildes, con al menos 3 clientes por opción) → texto.
- `similarTo`: claves que parecen el mismo dato (`resposta` ~ `respuesta`, `respuesta_menu`). Unirlas es la fase 2; hoy solo se avisa.
- `POST /contact-fields/adopt` convierte hasta 50 a la vez y **valida todo antes de guardar**: si uno está mal, no se crea ninguno.

## API y permisos

| Ruta | Permiso |
|---|---|
| `GET /contact-fields` (campos, uso, sistema, `undefinedKeys`, `canManage`) | `contacts.read` |
| `GET /contact-fields/discover` · `POST /contact-fields` · `POST /contact-fields/adopt` · `PATCH /contact-fields/:id` | `contacts.manage` |
| `DELETE /contact-fields/:id?confirm=<clave>` (borra la definición y el dato en todos los clientes, en una transacción) | `contacts.manage` |

`contacts.manage` es de dueños y administradores (`RoleDefinitions`). El Asesor y Solo lectura los ven; no los cambian.

## Los campos en los bloques (fase 2a)

- **Elegir el campo** (`FieldPicker`) en Esperar respuesta, Menú, Integración (cada dato de la respuesta), IA (la respuesta) y Condicional: se busca por nombre o clave, se ve su tipo y qué tan lleno está, se crea uno ahí mismo (dueños y administradores; el diálogo va por portal fuera del lienzo) o se deja **solo en esta conversación** (un dato de paso). Llegan por `ToolResources.contactFields` (una carga al abrir el editor, refresco al volver a la pestaña).
- **Menú:** si el campo es una lista y alguna opción del menú no está entre sus opciones, se avisa (esa elección no llegaría a la ficha).
- **Esperar respuesta → «Preguntar de nuevo»** (`onMismatch: "retry"`, `retryMessage?`): con un campo con tipo, si la respuesta no encaja (`coerceFieldValue`), el bloque vuelve a preguntar citando lo que escribió, con el mensaje según el tipo (`mismatchMessage`) o uno propio, y la espera empieza otra vez. Hasta `WAIT_RESPONSE_MAX_RETRIES` (2); después sigue y lo escrito queda solo en la conversación (`question_mismatch_kept`). Los intentos van en `__retry.<bloque>` (interno). El motor sabe el tipo por el puerto `ContactFieldCatalog` (producción y laboratorio: el catálogo real, solo lectura).
- **Condicional con tipo** (`TYPED_FIELD_OPERATORS`, `operatorsForFieldType`): lista `is_one_of`/`is_none_of` (opciones una por línea), número `between`, fecha `anniversary_today` (día y mes de hoy en la zona del negocio; un 29/02 cuenta el 28 en años no bisiestos), `within_next_days`, `at_least_days_ago`, `before_date`, `after_date`. El editor ofrece los de cada tipo con su control (botones de opciones, Sí/No, «entre», días, calendario) y muestra la regla **en palabras**. La validación es la misma en editor y servidor (`contracts/blocks/validation/condition.ts`); el MCP las aprende de su guía.
- **El laboratorio** repregunta y llena la ficha del cliente de prueba igual que un flujo real (`composeSimulationSandbox`).

## La ficha del cliente (fase 2a)

- `GET /contact-fields/values/:contactId` (contacts.read): sus datos (sin los internos `__`) y **de dónde salió** cada uno; `PATCH` (contacts.write: el Asesor también) con `{ changes }`: **solo lo que cambió**, `null` lo deja sin dato. Se mezcla con lo que hay: si un flujo guarda algo mientras la ficha está abierta, no se pisa. Cada valor se valida con su tipo; una clave que no es campo se rechaza.
- **Origen** (`contact_field_origins`, migración 050): una fila por cliente y clave con el último origen: `flow` (con `flow_key`, lo anota `ContactFieldSync`) o `team` (con `actor_id`). El bloque y la persona se buscan **al leer**: el bloque que llena esa clave en ese flujo (si es uno solo), con su nombre de hoy, y el verbo de su tipo («Lo respondió en», «Lo eligió en», «Lo trajo»). Borrar el campo o el dato borra su origen.
- **CRM:** cada campo en la forma de su tipo; los datos sueltos que guardó un flujo, aparte, con «Convertir en campo» (dueños y administradores; `NewFieldDialog` con `fixedKey`). El catálogo se carga una vez por página.

## Ordenar, unir y deshacer (fase 2b)

Contrato: `contracts/ContactFieldToolsContracts.ts`. Rutas: `routeContactFieldToolsRequest.ts` (todas `contacts.manage`, salvo lo que vende).

- **Sugerencias** (`domain/fieldSuggestions.ts`, van en `GET /contact-fields` como `suggestions`, solo para quien organiza): campos de lista con valores fuera de sus opciones, campos de texto que en realidad son una lista (`suggestType`), grupos de claves parecidas (`looksAlike`, transitivo) y las operaciones que aún se pueden deshacer. Solo sugieren.
- **Ordenar valores** (`GET /contact-fields/:id/values`, `POST …/tidy`; `domain/fieldTidy.ts`): se leen hasta 200 valores distintos y se agrupan. Solo se propone lo que se puede sostener: la misma palabra sin tildes ni signos, una o dos letras de diferencia o el comienzo de una opción → esa opción; un grupo nuevo que se repite (≥ 3 clientes y ≥ 2 %) → opción nueva; lo demás queda «como está». La persona confirma `assignments` (`to: null` = sin dato). El campo queda como lista con las opciones resultantes.
- **Unir campos** (`POST /contact-fields/merge/preview`, `POST /contact-fields/merge`; `domain/fieldMerge.ts`): varias claves pasan a una. Si un cliente tiene más de una gana **el dato más reciente** (por su origen; sin fecha, el de la clave que queda). Se borran las definiciones que sobran; si la clave que queda no era un campo, se crea heredando el tipo. **Primero los datos (una transacción) y después los flujos**: `renameFlowKeys` cambia la clave donde el bloque la guarda, donde la lee un Condicional y dentro de los textos (`{clave}`, `{clave|respaldo}`, `{{context.clave}}`), y se guarda por `SaveDraftService` (mismo candado de revisión). Un flujo que no se pudo guardar se reporta por su nombre (`flowsSkipped`): no se pisa el trabajo de quien lo edita.
- **Deshacer** (`POST /contact-fields/operations/:id/undo`, hasta `FIELD_OPERATION_UNDO_DAYS` = 7): `contact_field_operations` guarda las definiciones como estaban y los bloques cambiados (antes y después); `contact_field_operation_values`, por cliente, su dato antes y después (migración 051). Se devuelve **solo lo que sigue como lo dejó la operación**: un cliente cuyo dato cambió después, o un bloque editado después, no se toca (la comparación de bloques es canónica: la base reordena las claves del JSON). Lo que ya no se puede deshacer se limpia a los 30 días, al hacer la siguiente operación.
- **Lo que vende cada valor** (`GET /contact-fields/:id/sales?days=7|30|90`, pide `contacts.read` y `sales.read`): ventas aprobadas por valor del campo, **sin mezclar monedas** (una entrada por moneda; no depende del conversor del Dashboard). Una venta anotada a mano solo con el teléfono es del cliente de ese teléfono (misma regla que el Dashboard y Grupos). Los 6 valores que más venden, el resto junto, y «sin dato» aparte.

## Filtrar por campos (fase 2b)

`contracts/ContactFieldFilters.ts`: UNA forma (`in`, `yes`/`no`, `between` de números o fechas, `filled`/`empty`; hasta 5, se cumplen todos) y UNA regla en dos implementaciones que se prueban juntas: `matchesFieldFilters` (memoria) y `fieldFilterSql` (PostgreSQL; clave y valores siempre como parámetros).

- **Difusiones:** `AudienceFilter.fields` (opcional: una audiencia guardada sin él sigue igual). Se evalúa sobre la ficha del contacto del chat; el número «le llega a» cambia en vivo. También por MCP (`field_filters`).
- **CRM:** `GET /contacts?fields=<JSON>`.
- **Web:** `shared/contact-fields/FieldFilterEditor.tsx` (hacia afuera solo salen filtros completos).

## Lo que sigue

- Datos del negocio (variables globales `g_`) y mejoras de Etiquetas (diseños aprobados).
- «Lo que vende» con conversión de moneda si hace falta comparar países.
