# Meta Ads — módulo web (`/meta-ads`)

Las cuentas publicitarias conectadas y el rendimiento de cada campaña y anuncio: gasto, chats que trajo, ventas, facturación, ROAS y costo por venta. Tres secciones con diseño propio de Auream: **Píxel · Rendimiento · Cuentas**.

**Hoy:** `pages/MetaAdsPage.tsx`. Las secciones son **tarjetas de estado** (`components/AdsNav.tsx`), no pestañas subrayadas: cada una dice cómo está («1 activo», «1 token rechazado», «Sin conectar») y la elegida se enciende con el degradado de Auream. Por dentro es una lista de pestañas accesible (flechas, Inicio y Fin). La sección viaja en la dirección (`?tab=pixel` · `performance` · `accounts`).
- **Píxel** funciona (`pixel/`): sin píxeles, una portada con el recorrido de la conversión (chat → bloque Pixel → Meta) y los tres pasos; con píxeles, sus tarjetas y una más para conectar otro. Conectar, verificar, cambiar token, renombrar y eliminar.
- **Rendimiento** (`components/PerformanceSection.tsx`): la tabla compartida `shared/ads/AdsPerformanceTable` por campaña, conjunto o anuncio, con la venta real frente a Meta y qué hacer. Sin cuentas, lleva a Cuentas.
- **Cuentas** (`AccountsPanel`, `MetaAccountsList`, `MetaTokenDialog`): elegir cuentas, «Actualizar ahora» y desconectar. Al volver de Meta, la página avisa (`?meta=connected|error`). Cómo se conecta depende del servidor (`oauthAvailable`):
  - **Sin la app de Meta aprobada (hoy):** la acción principal es **«Conectar con un token»**, para todos los clientes por igual. Nunca se muestra un botón apagado. El diálogo trae los tres pasos para sacar un token de usuario del sistema (no vence, `ads_read`) y enlaza al paso a paso de la ayuda (`content/help/dashboard/conectar-meta-ads.md`). Si el token no sirve, el servidor dice qué arreglar: mal copiado o vencido, sin `ads_read`, o sin cuentas asignadas (`AdsProviderError.reason`).
  - **Con la app aprobada:** cuando Meta verifique el negocio y apruebe ads_read, se pone `META_LOGIN_CONFIG_ID` en producción. Esa variable es la que enciende «Conectar con Meta» (inicio de sesión para empresas, token de usuario del sistema que no vence, solo ads_read y permiso ANALYZE sobre las cuentas). Desde ahí ese botón es la opción principal y el token queda como segunda. `META_APP_ID` y `META_APP_SECRET` pueden ir antes: solo activan los avisos de borrado de Meta.
- La página abre en Rendimiento si Meta está conectado y en Cuentas si no.

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
