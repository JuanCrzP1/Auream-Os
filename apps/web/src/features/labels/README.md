# Etiquetas — módulo web (`/settings/labels`)

Cuántos clientes tiene cada etiqueta, cuánto vendieron, quién la usa, las repetidas y unir o borrar sin romper nada. Diseño: [`docs/architecture/labels.md`](../../../../../docs/architecture/labels.md).

## Estructura
```
features/labels/
├── LabelsSettings.tsx  la sección: barra, uniones en curso, repetidas, tabla y diálogos
├── list/       la tabla (tarjetas en angosto), el aviso de repetidas y el avance de las uniones
├── label/      el detalle (nombre, color y dónde trabaja), nueva etiqueta y unir o borrar
└── labelText.ts  textos puros (quién la usa, ventas sin mezclar monedas, caracteres invisibles)
```
Lo compartido vive en `shared/labels/`: la API, `useLabelsOverview` (se refresca solo mientras una unión avanza) y `LabelColorPicker`. La pestaña Etiquetas del CRM (`crm/contacts/components/ContactsSection.tsx`) lleva aquí.
- Cada componente importa su propio CSS. Archivos de hasta 200 líneas. La sección mide su ancho (container `lb`); los diálogos van fuera del marco medido.

## Permisos
Todos los que ven contactos las ven; el Asesor crea y cambia colores (`contacts.write`); renombrar, unir y borrar es de dueños y administradores (`contacts.manage`).
