# Meta Ads — módulo web (`/meta-ads`)

Las cuentas publicitarias conectadas y el rendimiento de cada campaña y anuncio: gasto, chats que trajo, ventas, facturación, ROAS y costo por venta. Tres secciones con diseño propio de Auream: **Píxel · Rendimiento · Cuentas**.

**Hoy:** `pages/MetaAdsPage.tsx`. Las secciones son **tarjetas de estado** (`components/AdsNav.tsx`), no pestañas subrayadas: cada una dice cómo está («1 activo», «1 token rechazado», «Sin conectar») y la elegida se enciende con el degradado de Auream. Por dentro es una lista de pestañas accesible (flechas, Inicio y Fin). La sección viaja en la dirección (`?tab=pixel` · `performance` · `accounts`).
- **Píxel** funciona (`pixel/`): sin píxeles, una portada con el recorrido de la conversión (chat → bloque Pixel → Meta) y los tres pasos; con píxeles, sus tarjetas y una más para conectar otro. Conectar, verificar, cambiar token, renombrar y eliminar.
- **Rendimiento** muestra la forma de la tabla de campañas, sin números inventados, y lleva a Cuentas.
- **Cuentas** muestra «Conectar con Meta» (aún sin usar) y lo que se obtiene al conectar.

## Estructura (cada carpeta se crea cuando tiene contenido real)
```
features/ads/
├── pages/        MetaAdsPage (encabezado, tarjetas de estado y la sección elegida)
├── pixel/        los píxeles de Meta (API de Conversiones) que usa el bloque «Pixel»:
│                 portada, recorrido, lista, diálogos y el estado de su tarjeta
├── components/   tarjetas de estado, iconos, Rendimiento y Cuentas; luego la tabla
│                 de campañas real y el selector de cuentas
├── hooks/        filtros y sincronización
└── services/     adsApi (/ads/*)
```
- Cada componente importa su propio CSS. Archivos de hasta 200 líneas.
- Las piezas se acomodan al ancho del panel con *container queries* (contenedores `ads` y `ads-nav`), no al de la ventana: la barra lateral también ocupa.
- Los datos que cruzan con la API se tipan en `contracts/` (`@contracts/*`), nunca aquí.

## Habla con
- Píxel: API `/pixel-connections` → dominio `domains/integrations`. Usa el kit compartido `shared/ui/integration-kit/` (tarjeta de conexión, avisos de carga y error, logo de Meta). La página carga los píxeles una vez y se los pasa a la sección y a su tarjeta de estado.
- Rendimiento y cuentas: API `/ads/*` → dominio `domains/ads` → Marketing API de Meta (`infrastructure/meta`).
- La carpeta se llama `ads` y no `meta`: el día que entren TikTok o Google Ads son otra sección, no otro módulo.

Mapa de todos los módulos: `docs/architecture/modules.md`.
