# Ventas y Productos

**Ventas** (`/sales`): cada venta con su producto, monto, moneda, cliente, número que vendió, flujo y anuncio de origen; las que esperan revisión; y el catálogo de **Productos** con su precio por país. Dominios [`domains/sales`](../../domains/sales/README.md) y [`domains/products`](../../domains/products/README.md) · web [`features/sales`](../../apps/web/src/features/sales/README.md) · bloque **Registrar venta** (`record-sale`).

## La regla central: nunca un precio inventado

Solo las ventas **completas** (producto, monto y moneda) cuentan en los totales. Si falta algo, la venta queda **«Por revisar»** con el motivo («Falta el monto», ««Video» no tiene precio en México») hasta que alguien la complete. Lo garantiza también la base: `sales_approved_complete_check` rechaza una venta aprobada incompleta aunque el código fallara.

Leona, en cambio, guarda un «precio de reserva» cuando el monto leído no cuadra: el dato queda mal y suma en los totales. Aquí se prefirió un número menos, pero cierto.

**Monedas:** los totales van por moneda; pesos y dólares nunca se suman.

## Cómo entra una venta

| Origen | Cómo | Quién |
|---|---|---|
| **Flujo** | El bloque **Registrar venta**, después de la salida «válido» del Comprobante, de una Integración de pago o de la confirmación de un asesor | El motor |
| **Asesor** | «Anotar venta» en Ventas (una venta cerrada por chat) | `sales.write` (también el Asesor) |
| Webhook | Previsto (`source = 'webhook'`) | — |

### El bloque Registrar venta

Separa responsabilidades: **el Comprobante verifica el pago; Registrar venta lo guarda**. Así sirve para cualquier forma de cobrar y para registrar productos distintos según la rama (principal, upsell o downsell).

```
Comprobante ──válido──> Registrar venta ──> Pixel (Compra con {venta.valor}) ──> …
```

- **Producto**: elegido del catálogo (solo activos). El bloque guarda el id y su nombre solo para mostrarlo en el lienzo; el motor usa el id.
- **Monto**: `variable` (por defecto `{comprobante.valor}` y `{comprobante.moneda}`) o `product`, el precio del producto en el país del cliente según su número de WhatsApp (`countryOfPhone`).
- **Cliente** (por defecto `{comprobante.nombre_pagador}`; si no hay, el nombre del contacto) y **referencia** (por defecto `{comprobante.referencia}`).
- **Sin duplicados**: el mismo comprobante (referencia) se registra una sola vez por cuenta; sin referencia, el mismo paso (sesión + bloque + mensaje) tampoco. Lo garantiza un índice único (`sales_origin_idx`), también con dos copias que llegan a la vez.
- Deja `{venta.id}`, `{venta.estado}` (`aprobada` · `por_revisar` · `error`), `{venta.producto}`, `{venta.valor}`, `{venta.moneda}` y `{venta.pais}`.
- **No detiene la conversación**: si guardar falla, el flujo sigue por su única salida y el motivo queda en el resultado.
- **Simulación y Laboratorio**: calculan la venta con el catálogo real **sin guardarla** (`DomainSalesLedger` en modo `preview`).
- Guarda además la conexión que vendió (de la conversación), la automatización y el anuncio de clic a WhatsApp del contacto (`ad_origin.sourceId`).

Los montos se leen con **la misma regla** que el Comprobante y el Pixel (`flow-engine/values/parseAmount`): «49.900» = 49900, «12,5» = 12.5, «$ 1.250,75» = 1250.75. Una venta y su evento de Compra nunca dan montos distintos.

## Arquitectura

```
Bloque Registrar venta (flow-engine) ──puerto SalesLedger──> DomainSalesLedger (apps/api)
                                                              └─> FlowSaleRecorder (domains/sales)
API /sales ──> SaleServices (domains/sales) ──puerto ProductCatalog──> ProductServices (domains/products)
API /products ──> ProductServices ──> ProductRepository
```

- El motor no conoce Ventas: declara `flow-engine/ports/SalesLedger.ts` y entrega los textos ya resueltos.
- Ventas no conoce el repositorio de Productos: declara `ProductCatalog`; lo cumple `ProductServices.findActive`.
- La composición (`apps/api/composition/composeSalesServices.ts`) es el único punto que elige SQL o memoria.

## Datos

`031_products_and_sales.sql` (aditiva):

- `products`: nombre único por cuenta (sin importar mayúsculas), descripción, `kind` (`main` · `upsell` · `downsell`) y `status` (`active` · `archived`). No se borra: se archiva y sus ventas se conservan.
- `product_prices`: un precio por país, en su moneda (la del país por defecto, o la que el negocio cobre allí, como USD en Venezuela). Guardar reemplaza todos los precios dentro de una transacción.
- `sales`: estado, origen, producto (con una copia de su nombre), monto, moneda, país, contacto, cliente, conexión, `flow_key`, anuncio, referencia, `origin_key`, motivo de revisión o anulación, nota, quién la anotó o revisó y `sold_at`.

## Permisos

| | Dueño | Administrador | Asesor | Solo lectura |
|---|---|---|---|---|
| Ver ventas, totales y catálogo (`sales.read`) | ✓ | ✓ | ✓ | ✓ |
| Anotar una venta (`sales.write`) | ✓ | ✓ | ✓ | — |
| Revisar, aprobar, anular y tocar el catálogo (`sales.manage`) | ✓ | ✓ | — | — |

## API

| Ruta | Permiso | Para qué |
|---|---|---|
| `GET /products` | `sales.read` | El catálogo (y `canManage`) |
| `POST /products` · `PATCH /products/:id` | `sales.manage` | Crear · editar o archivar |
| `GET /sales?status&productId&currency&source&from&to&search&cursor` | `sales.read` | Ventas (50 por página, la más reciente primero), totales por moneda de las aprobadas y cuántas hay por revisar. Las fechas van en la zona horaria de la empresa |
| `POST /sales` | `sales.write` | Anotar una venta |
| `PATCH /sales/:id` | `sales.manage` | Corregir; `status: approved` (solo completa) o `void` (con `voidReason`) |

Para agentes (MCP): `list_flow_resources` trae los productos activos con su precio por país, y la guía del bloque `record-sale` explica sus campos.

## La pantalla

- **Ventas**: totales del periodo por moneda (total, cantidad y ticket promedio), búsqueda (cliente, teléfono, referencia o anuncio), periodo y producto, y la tabla. Tocar una venta la abre: de dónde vino y, para quien puede, corregir, aprobar o anular.
- **Por revisar · N**: las incompletas con su motivo; se completan y se aprueban.
- **Productos · N**: tarjetas con el tipo, el precio en cada país y cuántas ventas lleva; crear, editar y archivar.

## Pruebas

`tests/unit/salesMoney.test.ts`, `productServices.test.ts`, `saleServices.test.ts`, `recordSaleBlock.test.ts`, `recordSaleHandler.test.ts`, `tests/security/routeSales.test.ts`, `tests/integration/salesPersistence.test.ts` (PostgreSQL real, con dos copias del mismo comprobante a la vez) y en la web `SalesPage.test.tsx` y `RecordSaleEditor.test.tsx`.

## Después

Webhook de entrada que registra ventas (pasarelas de pago), devoluciones parciales, factura electrónica, y el Dashboard (G1) y Meta Ads (G8) leyendo estas ventas (ROAS por anuncio con `ad_source_id`).
