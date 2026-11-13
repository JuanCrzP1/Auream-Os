# Campos del cliente — módulo web (`/settings/contact-fields`)

Los datos que la cuenta guarda de cada cliente, con su tipo, en cuántos clientes están y qué bloques los llenan o los leen. Diseño: [`docs/architecture/contact-fields.md`](../../../../../docs/architecture/contact-fields.md).

## Estructura
```
features/contact-fields/
├── ContactFieldsSettings.tsx  la sección: barra, por ordenar, tabla, del sistema y diálogos
├── list/       la tabla «Tuyos» (tarjetas en angosto), «por ordenar», los del sistema y el chip de tipo
├── field/      nuevo campo, el detalle (panel con encabezado oscuro), borrar escribiendo la clave, opciones y tipos
├── discovery/  el primer día: convertir en campos lo que tus flujos ya guardan
└── fieldText.ts  textos puros (porcentaje, «lo usan»)
```
Lo que comparten Configuración, el editor de flujos y la ficha del CRM vive en `shared/contact-fields/`: la API (`/contact-fields` y la ficha `/contact-fields/values/:id`), el catálogo único (`useContactFieldCatalog`), «Nuevo campo» (también para convertir una clave que ya existe), el chip y el selector de tipo, las opciones de una lista y sus textos (`fieldTypes.ts`). En el editor, cada bloque elige el campo con `builder/tools/_kit/FieldPicker.tsx`; en el CRM, la ficha está en `crm/contacts/components/fields/`.
- Cada componente importa su propio CSS. Archivos de hasta 200 líneas. La sección mide su ancho (container `cf`); los diálogos van fuera del marco medido para que su `position: fixed` no quede atrapado.
- La clave se arma con `keyFromLabel` del contrato: la misma regla que el servidor.

## Permisos
Todos los que ven contactos los ven (`contacts.read`); crear, convertir, editar y borrar es de dueños y administradores (`contacts.manage`).
