# Meta Ads — módulo web (`/meta-ads`)

Las cuentas publicitarias conectadas y el rendimiento de cada campaña y anuncio: gasto, chats que trajo, ventas, facturación, ROAS y costo por venta. Pestañas Campañas · Píxel · Cuentas, como en Leona.

**Hoy:** `pages/MetaAdsPage.tsx` cuenta lo que traerá. El Píxel sigue en Integraciones hasta que esta página tenga su pestaña.

## Estructura (cada carpeta se crea cuando tiene contenido real)
```
features/ads/
├── pages/        MetaAdsPage (pestañas Campañas · Píxel · Cuentas)
├── components/   tabla de campañas y anuncios, botón «Conectar con Meta», selector de cuentas
├── hooks/        filtros y sincronización
└── services/     adsApi (/ads/*)
```
- Cada componente importa su propio CSS. Archivos de hasta 200 líneas.
- Los datos que cruzan con la API se tipan en `contracts/` (`@contracts/*`), nunca aquí.

## Habla con
- API `/ads/*` → dominio `domains/ads` → Marketing API de Meta (`infrastructure/meta`).
- La carpeta se llama `ads` y no `meta`: el día que entren TikTok o Google Ads son otra pestaña, no otro módulo.

Mapa de todos los módulos: `docs/architecture/modules.md`.
