# Etiquetas

**Configuración › Datos › Etiquetas** (`/settings/labels`): el catálogo de etiquetas de la cuenta con lo que importa para decidir, y unir o borrar sin romper nada. La pestaña Etiquetas del CRM lleva aquí.

| Pieza | Dónde vive |
|---|---|
| Contrato | `contracts/LabelManagementContracts.ts` (usos, ventas, repetidas, uniones) |
| Reglas | `domains/contacts/domain/Label.ts` (`normalizeLabelName`, `labelKey`) · `domains/labels/domain/flowLabels.ts` (usos en flujos y renombrar) · `domains/labels/domain/labelRules.ts` (repetidas, cuándo se puede unir o borrar) |
| Servicios | `domains/labels/application/LabelManagementServices.ts` · `LabelMergeRunner.ts` (las vueltas de la cola) |
| Base | `SqlLabelRepository.ts` (catálogo) · `SqlLabelReferences.ts` (quién la usa y ventas) · `SqlLabelMerges.ts` (registro de uniones, clientes, públicos y webhooks) · migración `053_label_merges.sql` |
| API | `apps/api/routes/routeLabelsRequest.ts` · `composition/composeLabelServices.ts` (tarea `labels.merge`) |
| Web | `apps/web/src/features/labels` · `apps/web/src/shared/labels` (API, `useLabelsOverview`, `LabelColorPicker`) |

## Nombres que una persona lee igual

`labelKey` quita los caracteres invisibles (marcas de dirección que trae WhatsApp, espacios de ancho cero, espacio duro), las tildes y las mayúsculas: «Pagado», «pagádo» y «‎Pagado» son la misma. `normalizeLabelName` quita los invisibles al guardar.

- **No se crean repetidas:** `SqlLabelRepository.create/update` comparan con `labelKey` contra el catálogo (la base solo distinguía mayúsculas).
- **El motor encuentra la misma:** `findByNames` busca por `labelKey`. Si ya hay repetidas de antes, se usa **la más antigua** (`ContactDirectoryService.labelIds`). Por eso los usos por nombre (flujos, webhooks, campañas de grupos) se muestran en esa: es la que de verdad reciben.

## Quién la usa

| Uso | Cómo se encuentra |
|---|---|
| Etapa de un embudo | `crm_stages.label_id` |
| Flujos | bloque Etiquetas (`config.tags`, pone o quita) y reglas del Condicional `category: "tag"` (`value`), por nombre |
| Difusiones por enviar y públicos guardados | `audience.labelIds` / `excludeLabelIds`, por id |
| Webhooks | `mapping.addTags` / `removeTags`, por nombre |
| Campañas de grupos | `rules.labelOnJoin`: ponen la etiqueta con el nombre de la campaña |

**Ventas en 30 días:** ventas aprobadas de quienes la tienen hoy (por `contact_id` o, si se anotó a mano, por teléfono), por moneda; solo con `sales.read`.

## Unir (y «pasar y borrar»)

1. **Reglas:** una etapa del CRM no se une en otra (el embudo la perdería: se cambia en CRM). Sí se puede unir cualquiera EN una etapa. Una sola unión por etiqueta a la vez (`label_merges_running_idx`).
2. **Primero los usos:** los flujos se reescriben como un guardado del editor (`SaveDraftService`; un flujo ocupado se reporta en `flowsSkipped`), y en una transacción los públicos de difusiones por enviar, los públicos guardados y los webhooks. Desde ese momento nadie vuelve a poner la de origen.
3. **Después los clientes, por tandas** en la cola (`labels.merge`, 200 por vuelta): cada uno por `LabelRulesContactRepository.changeLabels` con `{ kind: "auto", note }`. Así se respetan las etapas (una por embudo) y el CRM actualiza el negocio y su historial. Repetir una vuelta no daña nada.
4. **Al final** se borra la de origen y la unión queda `done`. Si la última vuelta falla del todo queda `failed` (lo ya pasado se queda pasado).

**Borrar sin destino** solo si nadie la usa (`deleteProblem`): una etapa se perdería del embudo, y los flujos la volverían a crear.

## Renombrar

Cambia el nombre en los flujos y webhooks que la nombran (si cambia su `labelKey`). Es de `contacts.manage`. El color es de `contacts.write`.

## API

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/labels/overview` | `contacts.read` (ventas con `sales.read`) |
| PATCH | `/labels/:id` | `contacts.write` (color) · `contacts.manage` (nombre) |
| POST | `/labels/merge` | `contacts.manage` |
| DELETE | `/labels/:id[?into=<id>]` | `contacts.manage` |

`GET`/`POST /labels` siguen en `routeContactsRequest`.

## Pruebas

- `tests/unit/labelManagement.test.ts`: nombres, repetidas, usos y renombrar en flujos, reglas de unir y borrar, servicio y vueltas.
- `tests/security/routeLabels.test.ts`: permisos por rol.
- `tests/integration/labelManagementPersistence.test.ts`: unir una repetida EN una etapa con Contactos y el CRM reales (el cliente cambia de etapa y su negocio queda al día), difusión y webhook actualizados, aislamiento entre cuentas.
- `apps/web/tests/components/LabelsSettings.test.tsx`.
