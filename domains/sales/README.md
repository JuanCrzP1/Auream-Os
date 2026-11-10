# sales — ventas (bounded context)

Opción de la barra: **Ventas** (`/sales`), con la pestaña Productos. Web: `apps/web/src/features/sales/`.

## Responsabilidad
El registro de cada venta: qué se vendió, cuánto, en qué moneda y país, quién compró, por qué número, qué flujo la cerró y **de qué anuncio vino**, con su estado (aprobada, por revisar, reembolsada).

## Le pertenece
- La venta y su origen: el bloque Comprobante al aprobar un pago (automática), un asesor desde Conversaciones (manual) o un webhook de entrada.
- «Por revisar»: ventas incompletas (sin monto, sin producto) que no se cuentan hasta corregirlas.
- El tipo de venta: principal, upsell o downsell.

## No le pertenece
- El catálogo: `domains/products`. El gasto en anuncios: `domains/ads`.
- Validar el comprobante: el motor (`flow-engine`, bloque Comprobante); aquí llega ya aprobado.

## Depende de (por puertos)
`products` (precio y tipo), `contacts` y `conversations` (quién y desde qué chat). El anuncio de origen ya viene en el contacto (`sourceID` del anuncio de clic a WhatsApp).

## Capas
`domain/` (Sale, SaleOrigin, SaleStatus) · `application/` · persistencia SQL. API prevista: `/sales`.
