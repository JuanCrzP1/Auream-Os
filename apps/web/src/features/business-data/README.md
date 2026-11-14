# Datos del negocio — módulo web (`/settings/business-data`)

Lo que se repite en los mensajes de la cuenta (horario, dirección, link de pago, enlaces) escrito una vez y usado como `{g_…}`. Diseño: [`docs/architecture/business-data.md`](../../../../../docs/architecture/business-data.md).

## Estructura
```
features/business-data/
├── BusinessDataSettings.tsx  la sección: «Cómo funciona», barra, tabla, tarjeta de precios y diálogos
├── list/       «Cómo funciona», la tabla «Tus datos» (valor de ahora y su etiqueta; tarjetas en angosto) y «¿Precios? Van en Productos»
├── datum/      nuevo dato, el detalle en pestañas (Dato: «Así lo ve tu cliente» en cada momento, valor y dónde se usa), borrar y el valor según su tipo
├── schedules/  pestaña «Cambios programados»: tarjetas, formulario y textos (`scheduleText.ts`, en la hora de la empresa)
├── history/    pestaña «Historial»: la línea de tiempo y «Volver a este valor» (`historyText.ts`)
├── useMinute.ts  la hora al día cada minuto (un cambio que empieza se ve sin recargar)
└── businessDataText.ts  textos puros (dónde se usa, ayudas por tipo, la vista previa)
```
Lo que comparten Configuración, el editor de flujos, el chat y las difusiones vive en `shared/business-data/`: la API y `useBusinessData` / `useBusinessValues`. En el editor, la regla «Dato del negocio» del Condicional es `builder/tools/conditional/BusinessDataRule.tsx`.
- Cada componente importa su propio CSS. Archivos de hasta 200 líneas. La sección mide su ancho (container `bd`); los diálogos van fuera del marco medido.
- La clave se arma con `businessKeyFromLabel` del contrato: la misma regla que el servidor.

## Permisos
Todos los que ven flujos los ven, con su historial (`flows.read`); el chat lee solo los valores (`conversations.read`); crear, cambiar, programar y borrar es de dueños y administradores (`flows.write`).

«Cómo funciona» (`shared/ui/how-it-works`) es el mismo cuadro de Campos del cliente: se cierra con «Entendido» (se recuerda en el navegador) y queda abierto mientras no haya datos.
