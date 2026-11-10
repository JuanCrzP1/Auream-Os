# CRM — módulo web (`/crm`)

Los clientes y su proceso de venta en un solo lugar, al estilo FunnelChat: contactos con etiquetas y campos, etapas de venta con su valor, quién los atiende y qué seguimiento toca.

**Hoy:** el sub-módulo `contacts/` (lista, ficha, etiquetas) es la página de `/crm`. `/contacts` redirige aquí.

## Estructura (cada carpeta se crea cuando tiene contenido real)
```
features/crm/
├── contacts/     contactos, ficha y etiquetas (ya funciona)
├── pipeline/     etapas de venta y oportunidades con su valor
└── follow-ups/   seguimientos con fecha y responsable
```
- Cada componente importa su propio CSS. Archivos de hasta 200 líneas.
- Los datos que cruzan con la API se tipan en `contracts/` (`@contracts/*`), nunca aquí.

## Habla con
- `contacts/` → API `/contacts`, `/labels` → dominio `domains/contacts`.
- `pipeline/` y `follow-ups/` → API `/crm/*` → dominio `domains/crm`.

Mapa de todos los módulos: `docs/architecture/modules.md`.
