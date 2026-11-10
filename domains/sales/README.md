# sales — ventas (bounded context)

Opción de la barra: **Ventas** (`/sales`), con la pestaña Productos. Web: `apps/web/src/features/sales/`.

## Responsabilidad
El registro de cada venta: qué se vendió, cuánto, en qué moneda y país, quién compró, por qué número, qué flujo la cerró y **de qué anuncio vino**, con su estado (aprobada, por revisar, reembolsada).

## Le pertenece
- La venta y su origen: el bloque **Registrar venta** (después del Comprobante «válido» o de un pago confirmado), un asesor («Anotar venta») o un webhook de entrada (previsto).
- «Por revisar»: ventas incompletas (sin monto, sin producto) que no se cuentan hasta corregirlas.
- El tipo de venta: principal, upsell o downsell.

## No le pertenece
- El catálogo: `domains/products`. El gasto en anuncios: `domains/ads`.
- Validar el comprobante: el motor (`flow-engine`, bloque Comprobante). El Comprobante verifica; Registrar venta guarda.

## Depende de (por puertos)
`products` (precio y tipo), `contacts` y `conversations` (quién y desde qué chat). El anuncio de origen ya viene en el contacto (`sourceID` del anuncio de clic a WhatsApp).

## Capas
- `domain/`: `Sale` (qué falta para aprobar, estado inicial), `Money` (montos con la regla del Comprobante), `SalePeriod` (fechas en la zona de la empresa), `SaleInput`.
- `application/`: `SaleServices` (API), `FlowSaleRecorder` (bloque Registrar venta; `preview` para la simulación), puertos `SaleRepository` y `ProductCatalog`.
- Persistencia: `SqlSaleRepository` (`sales`, 031) · `InMemorySaleRepository`. API: `/sales`.

Detalle: [`docs/architecture/sales.md`](../../docs/architecture/sales.md).
