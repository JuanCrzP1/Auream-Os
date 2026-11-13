# Campos del cliente

**Configuración › Datos › Campos del cliente** (`/settings/contact-fields`): el catálogo de los datos que la cuenta guarda de cada cliente, con nombre, clave y **tipo**.

| Pieza | Dónde vive |
|---|---|
| Contrato | `contracts/ContactFieldContracts.ts` |
| Dominio | `domains/contact-fields` (`domain/`: reglas puras · `application/`: servicio y paso al cliente) |
| Base | `infrastructure/persistence/sql/SqlContactFields.ts` · migración `049_contact_fields.sql` |
| API | `apps/api/routes/routeContactFieldsRequest.ts` · `composition/composeContactFieldServices.ts`, `contactFieldTurns.ts` |
| Web | `apps/web/src/features/contact-fields` |

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

## Lo que sigue (fase 2)

- Elegir el campo de una lista en los bloques (Esperar respuesta, Menú, Integración, Condicional).
- La ficha del cliente con los campos tipados.
- Unir claves parecidas y agrupar valores escritos de varias formas, siempre con confirmación.
- «Lo que vende cada valor» (ventas por ciudad, por producto de interés).
- Filtrar difusiones y el CRM por campos.
