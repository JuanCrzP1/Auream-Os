# Frontend — `apps/web`

SPA en React + Vite, con React Router. El canvas del builder usa React Flow (`@xyflow/react`).

Se comunica con el backend exclusivamente por HTTP. Nunca importa código fuente de `domains/`, `platform/` ni `infrastructure/`.

## Organización

```
apps/web/src/
├── main.tsx
├── app/
│   ├── App.tsx
│   ├── router/           rutas → features
│   └── navigation/       sidebar: ítems, rutas e iconos
├── features/             una carpeta por área de producto
└── shared/               transversal a dos o más features
```

## Cuándo es cada cosa

| Concepto | Criterio | Ejemplo |
|---|---|---|
| **app** | Unidad desplegable | `apps/web` — hay una sola |
| **feature** | Un área del sidebar | `features/automations` |
| **sub-módulo** | Superficie grande dentro de una feature, sin entrada propia en el sidebar | `features/automations/builder` |
| **component** | Pieza visual | `BuilderCanvas`, `AutomationFlowCard` |
| **page** | Componente que una ruta monta | `AutomationsHubPage` |
| **shared UI** | Usado por dos o más features | `shared/ui/AppSidebar` |

El builder es sub-módulo, no feature: es una superficie grande de Automatizaciones, pero no un ítem del sidebar.

## Features y navegación

La barra lateral tiene el trabajo del día, en orden fijo: `app/navigation/sidebar/sidebar-items.tsx` es la única fuente de verdad. Lo administrativo vive en el **menú de la cuenta**, la tarjeta de abajo en la barra (`app/navigation/account/account-menu-items.tsx`; detalle en [`account.md`](account.md)). Dónde vive cada pieza de cada opción (web, API, dominio, proveedor): [`modules.md`](modules.md).

| Área | Ruta | Módulo | Estado |
|---|---|---|---|
| Dashboard | `/dashboard` | `features/dashboard` | `NO IMPLEMENTADO` — su página cuenta lo que traerá |
| Conversaciones | `/conversations` | `features/conversations` | `IMPLEMENTADO` — bandeja con filtros y etiquetas, chat en vivo con chulos de WhatsApp, respuesta del asesor y «Ejecutar flujo» |
| CRM | `/crm` | `features/crm` (`contacts/`) | `IMPLEMENTADO` (contactos y etiquetas) — etapas y seguimientos por construir. `/contacts` redirige aquí |
| Automatizaciones | `/automations` | `features/automations` | `IMPLEMENTADO` — hub y builder |
| Agentes de IA | `/ai-agents` | `features/ai-agents` | `PREPARADO` — placeholder (FASE E) |
| Difusiones | `/broadcasts` | `features/broadcasts` | `NO IMPLEMENTADO` — su página cuenta lo que traerá |
| Grupos y comunidades | `/groups` | `features/groups` | `NO IMPLEMENTADO` — su página cuenta lo que traerá |
| Meta Ads | `/meta-ads` | `features/ads` | `IMPLEMENTADO` (sección Píxel) — rendimiento y cuentas por construir |
| Ventas | `/sales` | `features/sales` | `NO IMPLEMENTADO` — su página cuenta lo que traerá |
| Conexiones | `/connections` | `features/connections` | `IMPLEMENTADO` |
| Integraciones | `/integrations` | `features/integrations` | `IMPLEMENTADO` |
| Mi perfil | `/profile` | `features/account` | `IMPLEMENTADO` — menú de la cuenta |
| Configuración | `/settings` | `features/account` | `IMPLEMENTADO` — Empresa y Apariencia, menú de la cuenta |
| Equipo · Pagos y suscripciones · Ayuda | `/team` · `/billing` · `/help` | — | `NO IMPLEMENTADO` — «Pronto» en el menú de la cuenta |

Ninguna opción visible manda a otra pantalla sin avisar: las que se están construyendo tienen su página en su módulo (`app/router/moduleRoutes.tsx`, `app/router/accountRoutes.tsx`).

Estructura interna de una feature con contenido:

```
features/automations/
├── list/       el hub: pages components hooks services types utils
└── builder/    el editor: pages components hooks services adapters types

features/crm/
├── contacts/   contactos, ficha y etiquetas
├── pipeline/   (por construir) etapas de venta y oportunidades
└── follow-ups/ (por construir) seguimientos
```

Cada módulo trae su `README.md` con su estructura y la API con la que habla.

Dos responsabilidades, dos módulos, nada suelto en la raíz de la feature. Detalle en [`automations.md`](automations.md).

## shared

Solo lo transversal:

| Carpeta | Contenido |
|---|---|
| `auth/` | Contexto de sesión — `useAuthSession()`; la cuenta activa (`ActiveTenantProvider`) y `useCan(permiso)` (`tenant/usePermissions.ts`): qué puede hacer la persona según `/me/tenants` |
| `http/` | Cliente HTTP y cliente de la API del builder |
| `config/` | Base URL de la API y lectura de la API key de desarrollo |
| `ui/` | `AppSidebar` (con su CSS) y el layout `app-shell` |
| `ui/auth-layout/` | El marco de acceso de Auream (panel de marca y tarjeta): lo usan el inicio de sesión, el registro y la página de invitación al equipo |
| `team/` | Nombres, descripciones y colores de los roles del equipo (`teamRoles.ts`): el menú de la cuenta y Equipo |
| `ui/integration-kit/` | Kit de conexiones con servicios (Integraciones y Meta Ads): logos de marca, tarjeta de conexión, sección, avisos de carga y error (`ConnectionListNotice`, para secciones con diseño propio), diálogo de renombrar o cambiar la clave y campo secreto |
| `account/` | La cuenta: `AccountProvider`, la tarjeta y el menú de la cuenta, el avatar y la API de Mi perfil y Empresa |
| `styles/` | Sólo `base.css` y `theme.css` — lo verdaderamente global |
| `test-utils/` | Setup de pruebas |

No existe `shared/types/` ni `features/*/types/` para datos de la API: los contratos compartidos con el backend viven en `contracts/` y se consumen por `@contracts/*`. Las features sólo declaran tipos propios cuando son exclusivamente de presentación — por ejemplo `builder/types/canvas.ts`, que describe el lienzo de React Flow y nunca cruza HTTP.

**La regla:** un módulo con un solo consumidor pertenece a esa feature. Se aplicó literalmente — el canvas, el editor, los paneles, los hooks del builder y sus adapters estaban en `shared/` con un único consumidor y se movieron a `features/automations/builder/`.

Antes de añadir algo a `shared/`, cuenta sus consumidores. Con uno, no va ahí.

## CSS: cada feature es dueña del suyo

No hay una hoja de estilos global que acumule las clases de todas las pantallas. **Cada componente importa su propio CSS**, junto al componente:

```
features/automations/builder/components/panels/release-panel.css
features/automations/list/components/hub-card.css
shared/ui/app-sidebar.css
```

En `shared/styles/` sólo quedan `base.css` y `theme.css`.

Antes existían `hub.css` (494 líneas), `canvas.css` (346), `palette.css` (260) y `legacy.css` (491) importados globalmente desde `index.css`, con estilos de una sola feature. Se repartieron por responsabilidad y se eliminó el CSS sin consumidores: 37 de las 59 clases de `legacy.css` no las usaba ningún componente, y `.flow-node-card*` estaba entero muerto. El bundle CSS bajó un 18%.

Un `.css` que supere 200 líneas debe revisarse por mezcla de responsabilidades.

## Aliases

```ts
import { useAuthSession } from "@shared/auth/context/AuthContext";
```

`@shared`, `@features`, `@app` y `@contracts` están definidos en `vite.config.ts`, `vitest.config.ts` y `tsconfig.json`. Los tres archivos deben mantenerse sincronizados.

`@contracts` apunta a `contracts/` en la raíz del repositorio: es la **fuente única** del modelo de grafo, compartida con el backend. Prohibido redefinir esos tipos en `apps/web`.

Dentro de una misma feature se usan rutas relativas; los aliases son para cruzar entre áreas.

## Autenticación

`shared/auth` es la sesión real de la plataforma, contra Neon Auth: `AuthContext` la expone vía `useAuthSession()`, la cookie del proveedor sostiene la sesión y el JWT vive solo en memoria (`tokenStore`), nunca en `localStorage`. `useAuthSession()` es el único contrato que un componente debe leer — ninguno debe resolver el `tenantId` por su cuenta. Detalle completo en [`auth.md`](auth.md).

Aparte de esa identidad de usuario, existe una vía separada de **credencial de máquina** para desarrollo local y scripts: `shared/config/getDevApiKey.ts` lee `VITE_DEV_API_KEY` **sólo cuando `import.meta.env.DEV` es true**, de modo que la rama se elimina del build de producción y ninguna credencial queda compilada en el bundle. Si la variable no está definida, no se envía cabecera `X-Api-Key`. No sustituye a la identidad de usuario; conviven.

`getBuilderApiBaseUrl()` exige `VITE_API_BASE_URL` en producción y falla si falta: es preferible a apuntar a `localhost` desde un despliegue real.

## Piezas comunes de página (`shared/ui`)

Los módulos de la aplicación (Contactos, Integraciones…) comparten:

- `page/page.css` — `.ui-page`, cabecera, pestañas y panel.
- `controls/controls.css` — botones (`.ui-btn`), campos, errores de formulario y el diálogo centrado (`.ui-overlay` / `.ui-dialog`).
- `state/StateCard` — la tarjeta de error, vacío o sin resultados, con `RetryButton` e iconos (`stateIcons`).

Cada módulo conserva solo lo propio en su CSS (la tabla de Contactos, las tarjetas de Integraciones). Una feature no importa de otra: lo que usan dos o más vive aquí.
