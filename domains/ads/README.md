# ads — anuncios pagados (bounded context)

Opción de la barra: **Meta Ads** (`/meta-ads`). Web: `apps/web/src/features/ads/`.

## Responsabilidad
Lo que se gasta en anuncios y lo que trae cada uno: las cuentas publicitarias conectadas, el catálogo de campañas, conjuntos y anuncios, las métricas diarias (gasto, impresiones, clics, conversaciones iniciadas) y la **atribución** de cada venta al anuncio que la originó. Lo mejor de Vyper, sin webhooks: el chat ya trae su anuncio.

## Le pertenece
- Cuentas publicitarias conectadas con «Conectar con Meta» (inicio de sesión de Meta, no webhook) y su token cifrado.
- Catálogo y métricas sincronizadas (por día, con la moneda de la cuenta).
- La sincronización con Meta (cola de tareas `ads.sync`). El ROAS real y el costo por venta se calculan al leer, en `domains/analytics`.

## No le pertenece
- Las ventas: `domains/sales` (aquí solo se cruzan con el gasto).
- El Píxel (Conversions API): en `domains/integrations` (`/pixel-connections`); se administra en la página de Meta Ads, sección Píxel.

## Depende de (por puertos)
Un puerto `AdsProvider` que implementa `infrastructure/meta` (Marketing API; ahí ya vive el Píxel). Proveedor-agnóstico: TikTok o Google se suman como otro adaptador. Sincroniza con `scheduling`.

## Capas (hecho, 2026-11-10)
- `domain/AdAccount.ts`: conexión, cuenta, campaña/conjunto/anuncio y la métrica diaria.
- `application/`:
  - `AdConnectionServices` (conectar con inicio de sesión o token, elegir cuentas, sincronizar ya, desconectar);
  - `AdsSyncService` (la vuelta de sincronización);
  - `OAuthState` (el `state` firmado);
  - `AdsPorts` (`AdsProvider`, `AdsRepository`).
- Adaptadores: `infrastructure/meta/MetaMarketingClient.ts` y `infrastructure/persistence/sql/SqlAdsRepository.ts`.
- API: `/ads/*`. El rendimiento lo calcula `domains/analytics` (`/dashboard/ads`). Ficha: [`docs/architecture/dashboard.md`](../../docs/architecture/dashboard.md).

**Requisito de Meta:** para cuentas de otros negocios, la app pasa la revisión de Meta (como Leona); para las propias funciona de una vez.
