# CRM — módulo web (`/crm`)

El embudo de ventas, los contactos y los seguimientos en un solo lugar. Detalle: [`docs/architecture/crm.md`](../../../../../docs/architecture/crm.md).

## Estructura
```
features/crm/
├── pages/        CrmPage: cabecera, pestañas (Embudo · Contactos · Seguimientos) y la ficha
├── pipeline/     tablero (columnas, tarjetas, arrastrar, «Mover a…»), lista, cinta del embudo,
│                 números, configurar, agregar cliente, «¿por qué no compró?»
├── deal/         la ficha del cliente: etapa, valor, responsable, seguimientos, historial
├── follow-ups/   la pestaña Seguimientos y el formulario rápido
├── contacts/     contactos y etiquetas (la pestaña Contactos)
├── services/     crmApi (`/crm/*`)
└── crmFormat.ts  las palabras del CRM (hace cuánto, cuándo toca, porcentajes)
```
- Cada componente importa su propio CSS. Archivos de hasta 200 líneas.
- Los datos que cruzan con la API se tipan en `contracts/CrmContracts.ts` y `CrmActivityContracts.ts`.
- La pestaña, la vista y el embudo viajan en la dirección (`?tab=follow-ups`, `?view=list&stage=…`, `?pipeline=…`).

## Habla con
- `pipeline/`, `deal/`, `follow-ups/` → API `/crm/*` → dominio `domains/crm`.
- `contacts/` → API `/contacts`, `/labels` → dominio `domains/contacts`.
- «Abrir chat» lleva a Conversaciones buscando el número (`/conversations?search=…`).
