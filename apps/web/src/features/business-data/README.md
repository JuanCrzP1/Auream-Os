# Datos del negocio — módulo web (`/settings/business-data`)

Lo que se repite en los mensajes de la cuenta (Pago Móvil, horario, dirección, enlaces) escrito una vez y usado como `{g_…}`. Diseño: [`docs/architecture/business-data.md`](../../../../../docs/architecture/business-data.md).

## Estructura
```
features/business-data/
├── BusinessDataSettings.tsx  la sección: barra, tabla, tarjeta de precios y diálogos
├── list/       la tabla «Tus datos» (tarjetas en angosto) y «¿Precios? Van en Productos»
├── datum/      nuevo dato, el detalle (con «Así lo ve tu cliente» y dónde se usa), borrar y el valor según su tipo
└── businessDataText.ts  textos puros (dónde se usa, ayudas por tipo, la vista previa)
```
Lo que comparten Configuración, el editor de flujos, el chat y las difusiones vive en `shared/business-data/`: la API y `useBusinessData` / `useBusinessValues`. En el editor, la regla «Dato del negocio (variable global)» del Condicional es `builder/tools/conditional/BusinessDataRule.tsx`.
- Cada componente importa su propio CSS. Archivos de hasta 200 líneas. La sección mide su ancho (container `bd`); los diálogos van fuera del marco medido.
- La clave se arma con `businessKeyFromLabel` del contrato: la misma regla que el servidor.

## Permisos
Todos los que ven flujos los ven (`flows.read`); el chat lee solo los valores (`conversations.read`); crear, cambiar y borrar es de dueños y administradores (`flows.write`).
