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

La barra lateral tiene el trabajo del día, en orden fijo: `app/navigation/sidebar/sidebar-items.tsx` es la única fuente de verdad. Lo administrativo vive en el **menú de la cuenta**, la tarjeta de abajo en la barra (`app/navigation/account/account-menu-items.tsx`; detalle en [`account.md`](account.md)).

| Área | Ruta | Dónde | Estado |
|---|---|---|---|
| Dashboard | `/dashboard` | Barra | `NO IMPLEMENTADO` — página «Próximamente» |
| Conversaciones | `/conversations` | Barra | `IMPLEMENTADO` — bandeja con filtros y etiquetas, chat en vivo con chulos de WhatsApp, respuesta del asesor y «Ejecutar flujo» |
| Automatizaciones | `/automations` | Barra | `IMPLEMENTADO` — hub y builder |
| AI Agents | `/ai-agents` | Barra | `PREPARADO` — placeholder |
| Conexiones | `/connections` | Barra | `IMPLEMENTADO` |
| Contactos | `/contacts` | Barra | `IMPLEMENTADO` — lista con búsqueda y filtro, ficha editable y catálogo de etiquetas |
| Integraciones | `/integrations` | Barra | `IMPLEMENTADO` |
| Mi perfil | `/profile` | Menú de la cuenta | `IMPLEMENTADO` — foto, nombre, WhatsApp personal, correo de acceso y contraseña |
| Empresa | `/settings` | Menú de la cuenta | `IMPLEMENTADO` — logo, nombre y zona horaria |
| Equipo | `/team` | Menú de la cuenta | `NO IMPLEMENTADO` — «Pronto» |
| Pagos y suscripciones | `/billing` | Menú de la cuenta | `NO IMPLEMENTADO` — «Pronto» (FASE F) |
| Ayuda y soporte | `/help` | Menú de la cuenta | `NO IMPLEMENTADO` — «Pronto» |

Las rutas «Pronto» tienen su `<Route>` con una página «Próximamente» (`app/router/accountRoutes.tsx`): ninguna opción visible manda a otra pantalla sin avisar.

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
