# ads — anuncios pagados (bounded context)

Opción de la barra: **Meta Ads** (`/meta-ads`). Web: `apps/web/src/features/ads/`.

## Responsabilidad
Lo que se gasta en anuncios y lo que trae cada uno: las cuentas publicitarias conectadas, el catálogo de campañas, conjuntos y anuncios, las métricas diarias (gasto, impresiones, clics, conversaciones iniciadas) y la **atribución** de cada venta al anuncio que la originó. Lo mejor de Vyper, sin webhooks: el chat ya trae su anuncio.

## Le pertenece
- Cuentas publicitarias conectadas con «Conectar con Meta» (inicio de sesión de Meta, no webhook) y su token cifrado.
- Catálogo y métricas sincronizadas (por día, con la moneda de la cuenta).
- La asignación campaña → producto (por fechas) y el cálculo de ROAS y costo por venta.

## No le pertenece
- Las ventas: `domains/sales` (aquí solo se cruzan con el gasto).
- El Píxel (Conversions API): hoy en `domains/integrations`; se mostrará en la misma página de Meta Ads.

## Depende de (por puertos)
Un puerto `AdsProvider` que implementa `infrastructure/meta` (Marketing API; ahí ya vive el Píxel). Proveedor-agnóstico: TikTok o Google se suman como otro adaptador. Sincroniza con `scheduling`.

## Capas
`domain/` (AdAccount, Campaign, Ad, DailyInsight, Attribution) · `application/` · adaptador en `infrastructure/meta`. API prevista: `/ads/accounts`, `/ads/campaigns`, `/ads/insights`.

**Requisito de Meta:** para cuentas de otros negocios, la app pasa la revisión de Meta (como Leona); para las propias funciona de una vez.
