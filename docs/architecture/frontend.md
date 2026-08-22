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

La navegación es fija: doce áreas en orden inmutable. `app/navigation/sidebar/sidebar-items.tsx` es la única fuente de verdad; reordenar o renombrar se hace ahí y en ningún otro sitio.

| Área | Ruta | Estado |
|---|---|---|
| Dashboard | `/dashboard` | `NO IMPLEMENTADO` |
| Conversaciones | `/conversations` | `NO IMPLEMENTADO` |
| Automatizaciones | `/automations` | `IMPLEMENTADO` — hub y builder |
| Conexiones | `/connections` | `PREPARADO` — placeholder |
| Contactos | `/contacts` | `NO IMPLEMENTADO` |
| Integraciones | `/integrations` | `NO IMPLEMENTADO` |
| AI Agents | `/ai-agents` | `PREPARADO` — placeholder |
| Equipo | `/team` | `NO IMPLEMENTADO` |
| Facturación | `/billing` | `NO IMPLEMENTADO` |
| Mi perfil | `/profile` | `NO IMPLEMENTADO` |
| Configuración | `/settings` | `NO IMPLEMENTADO` |
| Ayuda | `/help` | `NO IMPLEMENTADO` |

`NO IMPLEMENTADO` significa que la ruta está declarada en el sidebar pero no tiene `<Route>` en `AppRouter`: el catch-all redirige a `/automations`.

Estructura interna de una feature con contenido:

```
features/automations/
├── list/       el hub: pages components hooks services types utils
└── builder/    el editor: pages components hooks services adapters types
```

Dos responsabilidades, dos módulos, nada suelto en la raíz de la feature. Detalle en [`automations.md`](automations.md).

## shared

Solo lo transversal:

| Carpeta | Contenido |
|---|---|
| `auth/` | Contexto de sesión — `useAuthSession()` |
| `http/` | Cliente HTTP y cliente de la API del builder |
| `config/` | Base URL de la API y lectura de la API key de desarrollo |
| `ui/` | `AppSidebar` (con su CSS) y el layout `app-shell` |
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

## Autenticación en desarrollo

`shared/auth` sirve hoy una sesión de desarrollo fija. `shared/config/getDevApiKey.ts` lee la API key de `VITE_DEV_API_KEY` **sólo cuando `import.meta.env.DEV` es true**, de modo que la rama se elimina del build de producción y ninguna credencial queda compilada en el bundle. Si la variable no está definida, no se envía cabecera de API key.

`getBuilderApiBaseUrl()` exige `VITE_API_BASE_URL` en producción y falla si falta: es preferible a apuntar a `localhost` desde un despliegue real.

`useAuthSession()` ya es el contrato correcto: cuando exista identidad real solo cambia su implementación, no sus consumidores. Ningún componente debe leer el `tenantId` de otro sitio.
