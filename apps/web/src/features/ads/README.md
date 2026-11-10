# Meta Ads — módulo web (`/meta-ads`)

Las cuentas publicitarias conectadas y el rendimiento de cada campaña y anuncio: gasto, chats que trajo, ventas, facturación, ROAS y costo por venta. Pestañas Campañas · Píxel · Cuentas, como en Leona.

**Hoy:** `pages/MetaAdsPage.tsx` con sus pestañas. **Píxel** funciona (`pixel/`: conectar, verificar, cambiar token, renombrar y eliminar, con el logo de Meta); **Campañas** y **Cuentas** cuentan lo que traerán. La pestaña viaja en la dirección (`?tab=pixel`).

## Estructura (cada carpeta se crea cuando tiene contenido real)
```
features/ads/
├── pages/        MetaAdsPage (pestañas Campañas · Píxel · Cuentas)
├── pixel/        los píxeles de Meta (API de Conversiones) que usa el bloque «Pixel»
├── components/   pestañas; luego la tabla de campañas, «Conectar con Meta» y el selector de cuentas
├── hooks/        filtros y sincronización
└── services/     adsApi (/ads/*)
```
- Cada componente importa su propio CSS. Archivos de hasta 200 líneas.
- Los datos que cruzan con la API se tipan en `contracts/` (`@contracts/*`), nunca aquí.

## Habla con
- Píxel: API `/pixel-connections` → dominio `domains/integrations`. Usa el kit compartido `shared/ui/integration-kit/`.
- Campañas y cuentas: API `/ads/*` → dominio `domains/ads` → Marketing API de Meta (`infrastructure/meta`).
- La carpeta se llama `ads` y no `meta`: el día que entren TikTok o Google Ads son otra pestaña, no otro módulo.

Mapa de todos los módulos: `docs/architecture/modules.md`.
