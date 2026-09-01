# AUREAM OS — ROADMAP OFICIAL

Este documento es la **fuente única de verdad** del plan de construcción de AUREAM OS. Reemplaza cualquier otro roadmap, nota o lista de tareas que exista fuera de este archivo. No debe haber una segunda versión.

**AUREAM OS** es una plataforma SaaS conversacional multi-tenant: motor de automatizaciones visuales versionado, agentes de IA para ventas conversacionales, y gestión operativa de canales, contactos, equipo y facturación — con aislamiento real por tenant en cada capa.

---

## Cómo se usa este documento

- Cada tarea tiene **un** estado, de la lista cerrada de la sección siguiente. No se inventan estados nuevos.
- Una tarea solo pasa a `🟢 COMPLETADO` cuando está implementada **y** validada (build, typecheck, tests). Existir parcialmente no es completar.
- Cada fase se cierra antes de abrir la siguiente. No se adelanta trabajo de una fase futura para "ir más rápido".
- Después de cada tarea cerrada, este archivo se actualiza en la misma sesión de trabajo que la cierra — nunca como una tarea aparte y pospuesta. Ver [Regla de actualización](#regla-de-actualización).

## Estados

| Símbolo | Estado | Significado |
|---|---|---|
| ⬜ | POR HACER | No comenzó. |
| 🟡 | EN PROGRESO | Se está trabajando activamente. |
| 🔵 | APROBADO | Diseño/arquitectura revisado y aprobado; implementación aún pendiente o parcial. |
| 🟢 | COMPLETADO | Implementado **y** validado con tests/verificación real. |
| 🔴 | BLOQUEADO | No puede avanzar: depende de una decisión, credencial, proveedor o trabajo previo explícito. |
| ⚪ | NO APLICA | Descartado explícitamente. |

---

## Principios de arquitectura

- Multi-tenant real — todo dato, sesión, flow y recurso pertenece a un tenant; el aislamiento se impone en la firma de los puertos, no en la disciplina de quien llama.
- AI-first — pero la IA es una capacidad modular detrás de un puerto, nunca el núcleo acoplado del sistema.
- Modular — bounded contexts con fronteras explícitas, documentadas en [`docs/architecture/boundaries.md`](docs/architecture/boundaries.md).
- Una responsabilidad por archivo/módulo — no se mide solo por líneas; se mide por "¿tiene un único motivo para cambiar?".
- Bajo acoplamiento, alta cohesión.
- Domain-first — el dominio no conoce infraestructura concreta; depende de puertos.
- Infraestructura desacoplada — Vercel, Neon, OpenRouter y cualquier canal son adaptadores reemplazables, nunca supuestos del dominio.
- Seguridad por defecto — CORS por allowlist, scopes derivados en servidor, sin credenciales hardcodeadas.
- Tests orientados a comportamiento, no a implementación.
- Escalabilidad y sostenibilidad por encima de velocidad de entrega.
- Cero legacy innecesario. Cero lógica duplicada.
- **No se finge funcionalidad.** Si algo no está implementado, falla de forma explícita y se declara como tal — nunca se simula un resultado ni se muestra un control que no hace nada.

---

## Infraestructura objetivo

| Área | Tecnología |
|---|---|
| Web | Vercel |
| Database | Neon (PostgreSQL) |
| Authentication | Neon Auth |
| AI | OpenRouter |
| Canales iniciales | WhatsApp · Telegram |

**Ningún dominio depende directamente de estos proveedores.** Cada uno se integra detrás de un puerto declarado en `domains/*/application` o `platform/*`, implementado en `infrastructure/`, e inyectado desde `apps/api/composition/`. Reemplazar Neon por otro Postgres gestionado, o Vercel por otro host, o OpenRouter por un proveedor de IA distinto, es un cambio de adaptador — nunca un cambio de dominio. Esta regla ya se cumple hoy para persistencia y auth (ver [`docs/architecture/persistence.md`](docs/architecture/persistence.md) y [`docs/architecture/auth.md`](docs/architecture/auth.md)) y se exige igual para todo lo nuevo.

---

## Secuencia oficial de fases

Decisión de producto tomada el 2026-09-01: **la experiencia visual y UX de Automatizaciones se cierra ANTES de tocar persistencia y runtime.** Construir persistencia sobre un producto visual incompleto obliga a rehacerla cuando la UI revele lo que realmente necesita guardar.

```
FASE A  Fundación y control arquitectónico        🟢 COMPLETADA
   ↓
FASE B  Automatizaciones — producto visual        🟡 EN PROGRESO
   ↓
FASE C  Persistencia y Runtime real               ⬜
   ↓
FASE D  Canales y Conversations                   ⬜
   ↓
FASE E  AI Agents + AI Sales Engine               ⬜
   ↓
FASE F  SaaS, Usage y Billing                     ⬜
   ↓
FASE G  Producto visual restante                  ⬜
   ↓
FASE H  Producción y Escalabilidad                ⬜
```

---

## Estado actual

Verificado contra el repositorio el 2026-09-01, no copiado de la revisión anterior.

| Área | Estado | Observación |
|---|---|---|
| Auth | 🟢 COMPLETADO | Fase 1 cerrada — Neon Auth, JWT/JWKS, recuperación de contraseña |
| Tenancy | 🟢 COMPLETADO | Resolución por membership activa, aislamiento verificado contra Postgres real |
| Seguridad | 🟢 COMPLETADO | CORS por allowlist, sin credenciales hardcodeadas, tests en `tests/security/` |
| Branding | 🟢 COMPLETADO | Identidad AUREAM OS, tema claro/oscuro |
| **Automations — Builder base** | 🟢 COMPLETADO | Catalog + builder + validation + simulación funcionan de punta a punta |
| **Automations — experiencia visual completa** | 🟡 EN PROGRESO | Es la FASE B. Toolbox, conexiones y modularidad cerradas; editor de configuración, paneles, estados y gestión, pendientes |
| Toolbox (paleta de herramientas) | 🟢 COMPLETADO | Overlay flotante, cristal, plegado vertical, 13 herramientas, búsqueda, iconos propios |
| Arquitectura modular de herramientas | 🟢 COMPLETADO | `builder/tools/` con registry puro como única frontera; grafo de imports acíclico |
| Conexiones del canvas | 🟢 COMPLETADO | Bézier flexible, identidad azul→violeta, sin rótulo de prioridad |
| Topbar del builder | 🟢 COMPLETADO | Tarjeta flotante: volver, nombre editable en línea, pastilla de guardado. Sin publicar/versión/rollback |
| Lienzo: encuadre y minimapa | 🟢 COMPLETADO | Encuadre inicial alejado; minimapa de cristal por las variables de React Flow, sin marco gris |
| Autoguardado | 🟢 COMPLETADO | Debounce real, sin peticiones concurrentes, estado fiable, volcado al desmontar. Frontera lista para el bloqueo optimista de la FASE C |
| Frontera de edición del builder | 🟢 COMPLETADO | `BuilderEditingContext`; sin singletons mutables y con un solo dueño del estado del grafo |
| Editor de configuración de nodo | ⬜ POR HACER | El modal edita nombre y un textarea para las 13 herramientas; `config` nace y muere vacío |
| Paneles del builder | ⬜ POR HACER | `NodeInspector`, `EdgeInspector`, `ValidationPanel`, `SimulationPanel`, `ReleasePanel` y `CanvasHintBar`: **0 consumidores** |
| Estados del builder | 🟡 EN PROGRESO | El guardado ya dice la verdad (B14). Falta el resto: publicar inválido no informa, y no hay estados de nodo no ejecutable ni de flujo sin publicar |
| Gestión de automatizaciones | 🟡 EN PROGRESO | Listar, crear, abrir, renombrar, borrar y buscar funcionan; Duplicar, Archivar y Mover están en el menú sin implementación |
| Automations SQL | ⬜ POR HACER | Persistencia actual: JSON en disco, solo desarrollo local |
| Runtime real (disparo externo) | ⬜ POR HACER | El flow-engine solo se ejecuta desde la simulación del builder |
| Connections (canales) | ⬜ POR HACER | Frontera vacía, sin código |
| Conversations | ⬜ POR HACER | Frontera vacía, sin código |
| Contacts | ⬜ POR HACER | Frontera vacía, sin código |
| AI Agents | ⬜ POR HACER | Placeholder de UI alcanzable, sin backend |
| AI Sales Engine | ⬜ POR HACER | No integrado físicamente. Reservado a la FASE E, con auditoría propia previa |
| Billing | ⬜ POR HACER | Contratos y definiciones de plan existen; ningún endpoint los invoca |
| Usage | ⬜ POR HACER | Sin medición de consumo ni enforcement |
| Dashboard | ⬜ POR HACER | Depende de que exista actividad real que mostrar |
| Producción | ⬜ POR HACER | Dominio de Neon Auth sin registrar, sin remitente de correo propio, sin despliegue |

---

## FASE A — Fundación y control arquitectónico

**Estado: 🟢 COMPLETADA**

Objetivo: dejar la base documental y de reglas en un estado que no engañe a quien construya encima, y registrar formalmente lo que la auditoría ya demostró.

### A1 — Actualizar documentación obsoleta

**Estado: 🟢 COMPLETADO**

Archivos identificados por la auditoría, corregidos tras comparar contra el código real (no reemplazo ciego):

- [`docs/architecture/backend.md`](docs/architecture/backend.md) — eliminada la referencia a `JWT_SECRET` como requisito de arranque; reemplazada por la validación real (`NEON_AUTH_URL`, `NEON_AUTH_ISSUER`, `DATABASE_URL`). Añadidos `GET /me/tenants` y `POST /me/onboarding` a la tabla de endpoints, ausentes hasta ahora. Corregido el estado de `tenancy` en la tabla de `platform/` de `PREPARADO` a `IMPLEMENTADO` (la resolución por membership activa ya es real desde Fase 1); se conserva `PREPARADO` solo para `TenantResolver` del runtime de simulación, que es un concepto distinto.
- [`docs/architecture/frontend.md`](docs/architecture/frontend.md) — reescrita la sección "Autenticación en desarrollo": ya no describe "una sesión de desarrollo fija" sino la sesión real contra Neon Auth: cookie del proveedor + JWT en memoria vía `tokenStore`, con referencia a `auth.md` como fuente de detalle.
- [`docs/development/README.md`](docs/development/README.md) — eliminada `JWT_SECRET` de la tabla de variables de entorno del backend y sustituida por `NEON_AUTH_URL`/`NEON_AUTH_ISSUER`/`DATABASE_URL`; corregido el troubleshooting de `[FATAL] JWT_SECRET no está definido` por los fallos reales que `loadApiConfig`/`loadNeonAuthConfig`/`loadDatabaseConfig` producen hoy.

De paso, en `docs/development/README.md` se corrigieron también los contadores de tests (`207`/`77`) a los reales medidos en esa validación (`261`/`147`) — es el mismo tipo de deriva documental que A1 existe para cerrar. Esos contadores han vuelto a cambiar desde entonces (264/172); se actualizarán en la próxima tarea que toque ese documento, no se abre una tarea solo para eso.

**Hallazgo derivado, fuera de alcance de A1 (no se tocó código):** `scripts/dev/start.sh`, `scripts/dev/start.bat` y `tests/security/apiConfig.test.ts` todavía exportan/inyectan `JWT_SECRET`, pero `loadApiConfig` ya no lee esa variable — es legacy inerte, no un bug funcional (verificado leyendo `apps/api/config/loadApiConfig.ts`: no aparece `env["JWT_SECRET"]` en ningún punto). No se modificó por instrucción explícita de esa fase ("no cambies código"). Registrado como tarea de limpieza en [A4](#a4--reglas-arquitectónicas-permanentes) → backlog de legacy.

**Validación:**

| Comando | Resultado |
|---|---|
| `npm run check` (typecheck backend) | ✅ sin errores |
| `npm test` | ✅ 261/261 tests, 36 archivos — ninguno modificado |
| `npm --prefix apps/web run check` (typecheck frontend) | ✅ sin errores |
| `npm --prefix apps/web run test` | ✅ 147/147 tests, 24 archivos — ninguno modificado |
| `npm run build` | ✅ compila a `dist/` |
| `npm run build:web` | ✅ compila a `apps/web/dist/` |
| `git diff --check` | ✅ sin errores de espacio en blanco |

Archivos tocados, confirmados por `git status`: solo los tres documentos listados arriba + creación de `ROADMAP.md`. Cero cambios en código, tests, Auth, Neon, UI, CSS, `automations`, `flow-engine` o `ai-sales-engine/`.

**Dependencias desbloqueadas:** ninguna tarea de fases posteriores dependía de A1; su valor es evitar que la siguiente persona (o yo mismo) siga una guía de arranque incorrecta.

### A2 — Integración del AI Sales Engine

**Estado: ⬜ POR HACER — planificada para FASE E, no ahora**

Decisión de producto/arquitectura ya tomada: el AI Sales Engine **no se trabaja en esta etapa**. No es un bloqueo del proyecto — es una fase propia, más adelante, deliberadamente pospuesta porque es un motor grande, con código considerable, que requiere su propia auditoría antes de tocarlo.

La auditoría confirmó que `ai-sales-engine/` existe como carpeta en la raíz de este repositorio pero está vacía — el motor real, con su código, vive fuera de este repositorio. Eso no se investiga ni se resuelve ahora (nada de monorepo vs. submódulo vs. paquete vs. servicio HTTP): esa evaluación es trabajo de FASE E, no de FASE A.

**Mientras tanto, y hasta que se abra esa fase:**

- No se modifica, mueve, renombra ni refactoriza el AI Sales Engine.
- No se crea ningún puerto ni adaptador todavía en `domains/ai-agents/`.
- No se investiga ni se decide la estrategia de incorporación.
- Esto no bloquea el avance de AUREAM OS por ninguna otra fase — B, C, D, F, G y H no dependen de A2.

Ver [FASE E](#fase-e--ai-agents--ai-sales-engine) para el alcance completo de esa fase futura.

### A3 — Auditoría de arquitectura

**Estado: 🟢 COMPLETADO** — realizada, registrada aquí como referencia permanente.

Hallazgos verificados mecánicamente (no solo por lectura) contra las reglas de [`dependency-rules.md`](docs/architecture/dependency-rules.md):

- Fronteras entre dominios, entre `automations` y `flow-engine`, y entre frontend y backend: **limpias**. Cero cruces detectados por grep sobre imports reales.
- Single Responsibility: correcto en la muestra completa auditada. Los únicos dos archivos sobre 200 líneas (`tests/integration/setup/testAuthUsers.ts`, `tests/security/tenantIsolation.test.ts`) son fixtures/tests extensos por volumen de casos, no por mezcla de responsabilidades.
- Tenancy: correcto — todo puerto de repositorio exige `tenantId`; la resolución de tenant por membership activa está implementada y probada contra Postgres real.
- Seguridad: correcta — CORS por allowlist sin `*`, sin credenciales hardcodeadas, scopes derivados en servidor y nunca leídos del JWT.
- `flow-engine` separado de `automations` de forma real: solo se cruzan por `import type`, dirección única, verificado.
- AI Sales Engine: **no integrado físicamente** — carpeta reservada, vacía. Ver A2.
- Persistencia de `automations`: **todavía JSON**, marcada explícitamente como solo apta para desarrollo local, sin transacciones ni índices.
- Runtime real: **pendiente** — un flow publicado no se dispara solo; no existe emisor de eventos, cola, ni `apps/worker` con contenido.
- Rate limiting: implementado y probado (`platform/security/rate-limiting`), **no conectado** a la API (grep confirma cero referencias en `apps/api`).
- Documentación: parcialmente desactualizada por el cierre de Fase 1 — corregido en A1.

Auditoría completa entregada como reporte de conversación previo a este roadmap; no se duplica aquí, se referencia.

**Hallazgos de la auditoría del módulo Automatizaciones** (realizada después, y que originó la FASE B). Se registran aquí porque son deuda conocida, no descubrimientos por hacer:

- `GET /api/builder/flows/:flowKey/workspace` **escribe**: siembra el workspace y registra el flow en el catálogo. Exige `flows.read`, y el rol `viewer` tiene ese scope → **un viewer puede crear automatizaciones**. No existe endpoint de creación explícito.
- `autosaveRevision` parece un lock optimista y nunca se compara: dos pestañas se pisan sin aviso.
- `parseJsonBody` no tiene límite de tamaño y `handleSaveDraftRequest` persiste `body.draft` sin validar forma alguna.
- `PublishDraftService` lanza un `Error` plano → `toErrorResponse` lo convierte en 500 con el mensaje oculto → el frontend descarta la promesa: **publicar un grafo inválido no informa de nada**.
- Si la API no responde, `fetchBuilderWorkspace` devuelve un workspace local **no persistido** sin avisar al usuario. (El segundo tramo de este hallazgo —el autoguardado fallido mostrándose como «Guardado»— quedó corregido en B14.)
- El motor es **síncrono de punta a punta** (`ExecutionLoop`, `NodeRuntime`, `SessionStore`): bloquea el nodo `ai`, cualquier nodo con I/O y la persistencia SQL de sesiones.

Las tres primeras y las dos de UX pertenecen a la FASE B (son de experiencia y de API del builder); la última es prerrequisito de la FASE C.

### A4 — Reglas arquitectónicas permanentes

**Estado: 🟢 COMPLETADO** — reglas fijadas; su cumplimiento se re-verifica en cada fase futura con los mismos comandos de `dependency-rules.md`.

Queda explícitamente **prohibido**, en cualquier fase futura:

- Lógica de negocio dentro de un componente de UI (`apps/web`) — un componente renderiza y delega; la regla vive en un hook o en un caso de uso detrás de HTTP.
- Un dominio dependiendo de una implementación concreta de `infrastructure/` — siempre a través de un puerto.
- Dominios cruzándose entre sí directamente (`domains/<a>` → `domains/<b>`), salvo la excepción ya documentada `automations` → interfaces de `flow-engine` vía `import type`.
- Duplicar un contrato que ya vive en `contracts/` — incluido el frontend.
- Mega-servicios: un servicio de aplicación con más de un caso de uso real.
- Archivos con responsabilidades mezcladas — el criterio es "¿tiene un único motivo para cambiar?", no el conteo de líneas por sí solo.
- Lógica duplicada entre `apps/api` y `apps/worker`, o entre cualquier par de módulos — si ambos la necesitan, vive una vez en `domains/`.
- **Mapas globales por tipo de herramienta.** La identidad de una herramienta se declara una vez en su módulo y el registry es la única frontera de descubrimiento. Existieron cinco `Record<NodeType, …>` repartidos (paleta, iconos, colores, textos, título de editor) y se eliminaron.
- **Un módulo puro no puede depender de React.** `tools/registry.ts` y `validateCanvasGraph` los ejecuta también el test de paridad del backend: un icono en esa cadena rompe la ejecución.
- Legacy sin uso — código muerto no se conserva "por si acaso". El caso de `JWT_SECRET` detectado en A1 (scripts/tests que lo referencian sin que nada lo lea) queda registrado como deuda a limpiar en la primera tarea de código que toque esos archivos por otra razón — no se abre una tarea exclusiva solo para eso, para no violar la regla siguiente.
- Modificar un módulo estable (`automations`, `flow-engine`, `platform/identity`, `platform/authorization`, el login) sin una razón demostrable y documentada en este roadmap.

---

## FASE B — Automatizaciones: producto visual completo

**Estado: 🟡 EN PROGRESO**

Objetivo: cerrar **toda** la experiencia visual y de uso del módulo Automatizaciones antes de tocar persistencia o runtime.

> **Builder base ≠ Automatizaciones completo.** El builder tiene una base sólida —canvas, nodos, edges, drag & drop, autosave, publicación, validación, simulación— y por eso el Builder base figura 🟢 en la tabla de estado. Pero el producto no está terminado: hoy **no se puede configurar lo que hace un nodo**, y esa sola carencia convierte al builder en un editor de diagramas, no de automatizaciones. Esta fase existe para cerrar esa distancia.

### Lo ya cerrado en esta fase

#### B1 — Auditoría visual y de arquitectura del módulo · 🟢 COMPLETADO

Auditoría completa del módulo entregada como reporte, con sus hallazgos registrados en [A3](#a3--auditoría-de-arquitectura). Es la que fundamenta el desglose de esta fase: ninguna tarea de abajo es inventada, todas salen de una verificación contra el código.

#### B2 — Arquitectura modular de herramientas · 🟢 COMPLETADO

`apps/web/src/features/automations/builder/tools/` con **un módulo por herramienta** (`definition.ts` + su icono), un contrato `ToolDefinition` y `registry.ts` como **única frontera** de descubrimiento.

- Se retiraron las herramientas que ya no pertenecen al catálogo: `capture` (su escritura de contexto se absorbió en el nodo `question` vía `config.targetKey`), `fallback` como nodo (el rescate es una propiedad del edge, `isFallback`, que se conservó intacta en 24 archivos) y `action` (renombrada a `integration`, que es la misma herramienta con el nombre del producto).
- `end` permanece como **nodo de sistema**: sostiene la terminación del grafo y no se ofrece en la paleta.
- Se incorporaron las 7 herramientas que faltaban del catálogo oficial. Las 13 están registradas, con su handler en el motor y su tipo reconocido por la validación.
- Simetría verificada: **14 tipos = 14 handlers = 14 registros = 14 definiciones = 14 iconos**. Grafo de imports de `tools/` acíclico; ninguna herramienta importa a otra.
- Un tipo desconocido en un flow guardado degrada a presentación neutra y la validación lo señala, en vez de romper el canvas.

Tests: `toolRegistry.test.ts` (10), `PalettePanel.test.tsx` (5), `toolRegistryParity.test.ts` (3, contrato registry ↔ validación del backend).

**La estructura actual ya cumple la regla objetivo** (una herramienta = un módulo con responsabilidad clara, con varios archivos internos cuando haga falta). No necesita ajuste estructural: necesita **contenido** — cada módulo crecerá con su editor y su validación en B6.

#### B3 — Toolbox · 🟢 COMPLETADO

Paleta convertida en **overlay flotante** sobre el lienzo: dejó de ser una columna flex que restaba 260px al canvas. El lienzo ocupa ahora el área de trabajo completa y la paleta se superpone (`position: absolute`, `z-index: 3`) dentro de `.builder-workspace`, un contenedor con la única responsabilidad de ser el contexto de posicionamiento de los paneles que flotan sobre el canvas.

- Cristal translúcido con velo claro sobre fondo oscuro (comprobado renderizando: un velo oscuro sobre lienzo casi negro se ve macizo), `backdrop-filter: blur(20px) saturate(140%)`, borde y sombra tomados del lenguaje del sidebar.
- Plegado vertical: la tarjeta se reduce a un **botón cuadrado de 48×48 con el icono**, sin texto, sin pie y sin flecha adicional. El propio icono es el control en ambos estados.
- 13 herramientas con búsqueda por etiqueta y descripción, iconos propios y nombres sin truncar.
- **Arranca recogida**: al entrar al builder lo primero es el lienzo, no la lista. Mismo estado local, mismo control; no se añadió ningún estado nuevo.
- Densidad compactada en dos pasadas (icono 34px, fila ~46px) sin `transform: scale()`.
- Verificado renderizando en abierto, plegado y fotogramas intermedios de la animación.

#### B4 — Conexiones del canvas · 🟢 COMPLETADO

- Geometría **Bézier** en lugar de `smoothstep`: curva orgánica recalculada desde la posición real de los handles, robusta en todas las direcciones y distancias. Verificado en cinco escenarios renderizando React Flow real.
- **Prioridad retirada de la UI**: `buildEdgePresentation` deja de rotularla. El modelo la conserva íntegra (`contracts`, `EdgeEvaluator`, `validateEdgePriorities`) y sigue editable desde el inspector.
- Identidad visual: degradado azul eléctrico → violeta con halo de neón contenido; el fallback conserva su ámbar, su animación y su rótulo, que es semántica y no decoración.

Tests: `edgePresentation.test.ts` (10) — incluye ida y vuelta snapshot ↔ lienzo para garantizar que la prioridad sobrevive.

#### B11 — Topbar del builder · 🟢 COMPLETADO

Tarjeta flotante de cristal con cuatro esquinas redondeadas, separada del borde, en oscuro y claro, sin restar espacio al lienzo. Contiene exactamente cuatro cosas: **volver · nombre editable · lápiz · pastilla de estado de guardado**.

- `FlowNameEditor`: edición en línea, Enter confirma, Escape cancela, vacío rechazado, `trim` aplicado, y **blur no guarda** —salir del campo no debe decidir por el usuario—. El lápiz está siempre visible, no solo al pasar el ratón.
- `SaveStatusPill`: pastilla de cristal con `role="status"` que refleja los estados reales del autoguardado (`Guardado`, `Guardando…`, `Error al guardar`). Desde B14 esos estados son de fiar: antes podía decir «Guardado» sobre una petición fallida.
- **Retirados de la topbar**: `Publicar`, la etiqueta de versión `v1` y `Rollback`. El modelo del builder es editar → autoguardar. Las capacidades siguen existiendo intactas fuera de la topbar (`useBuilderPublishing`, `PublishDraftService`, `RollbackDraftService`) y se expondrán cuando se monten los paneles en B6, con su superficie de error y su confirmación —ambas siguen pendientes allí, no aquí—.

Tests: `FlowNameEditor.test.tsx` (15), `BuilderTopbar.test.tsx` (6), `SaveStatusPill.test.tsx` (5).

#### B16 — Lienzo: encuadre inicial y minimapa · 🟢 COMPLETADO

Tarea descubierta durante B11, numerada al final por orden de aparición.

- Encuadre inicial más alejado (`fitViewOptions` con `maxZoom: 0.8` y holgura): con un solo nodo el lienzo ya no abría «encima» de él. Solo afecta al encuadre inicial; el zoom que elija el usuario después no se toca.
- **Minimapa** convertido en tarjeta de cristal coherente con la Toolbox y la topbar. La causa del marco gris no era el borde: era `.react-flow__minimap-mask` pintándose con el default claro de React Flow (`rgba(240,240,240,.6)`), porque su hoja se emite **después** que la nuestra en el bundle y ganaba en cascada. Todas nuestras declaraciones de `background` y `fill` eran código muerto.
- La corrección pasa por el canal previsto por la librería —las variables `--xy-minimap-*`—, que no compiten en cascada por ser otro nombre de propiedad. Se retiró la prop `bgColor`, que ocupaba el tramo de máxima prioridad y dejaba a la hoja sin decisión. Posición, tamaño, `pannable` y `zoomable` sin tocar.
- Verificado renderizando React Flow real en seis escenarios, con el CSS enlazado en el mismo orden que el bundle de producción.

### Lo que falta para cerrar la FASE B

#### B5 — Editor de configuración por herramienta · ⬜ POR HACER — **la tarea central de esta fase**

`NodeEditorModal` expone hoy **dos campos —nombre y un textarea— para los 13 tipos**. `useCanvasNodes.updateSelectedNode` solo acepta `"title" | "preview"`. Consecuencia verificada: `config` de todo nodo creado en la UI queda `{}` para siempre.

Eso significa que hoy **no se puede**: escribir la condición de un Condicional, declarar el `targetKey` donde Esperar respuesta guarda la contestación (capacidad que sí existe ya en el motor), poner la URL de una Integración, la duración de un Intervalo, las opciones de un Menú ni las etiquetas de Etiquetas.

- Editor por herramienta, declarado en su propio módulo (`tools/<herramienta>/`), descubierto por el registry como ya se descubren etiqueta, icono y color.
- Decisión pendiente de aprobación: **editor por esquema declarativo** (más trabajo inicial, escala a N herramientas) frente a editores a medida por tipo. Recomendación: esquema.
- `ToolDefinition.defaultConfig` ya existe y hoy solo declara forma en `tags` y `menu`; el resto es `{}` a propósito, sin inventar campos.

#### B6 — Montar los paneles del builder · ⬜ POR HACER

Verificado por grep: `NodeInspector`, `EdgeInspector`, `ValidationPanel`, `SimulationPanel`, `ReleasePanel` y `CanvasHintBar` tienen **0 consumidores**. Existen, compilan y están completos.

Y lo que producen tampoco se consume: `builder.validation`, `builder.stats`, `builder.selectedNode`, `builder.selectedEdge`, `builder.simulationLog` y `handleSimulate` tienen **0 usos en TSX**. La validación se recalcula en cada render y se tira; **la simulación es inalcanzable desde la interfaz** pese a estar implementada de punta a punta en el backend.

Es trabajo de decisión de layout, no de arquitectura: el hook ya entrega todo lo necesario.

#### B7 — Estados del builder y de guardado · ⬜ POR HACER

Defectos verificados, todos de experiencia:

- ~~Un guardado fallido se muestra como «Guardado».~~ **Corregido en B14**: `SaveStatusPill` distingue los cuatro estados y `useDraftSync` solo marca guardado tras una respuesta correcta.
- **Si la API no responde**, el builder carga un workspace local no persistido y el usuario edita creyendo que guarda. Ya no se suma un estado que miente, pero el aviso de «esto no está persistido» sigue sin existir.
- **Publicar un grafo inválido no informa de nada**: el error viaja como 500 con el mensaje oculto y el frontend descarta la promesa.
- Faltan además: cambios sin publicar, resultado de validación visible, estado de herramienta no soportada en el lienzo (la regla `UNKNOWN_NODE_TYPE` ya existe en backend y ya avisa en `validateCanvasGraph`, pero nada lo muestra).

#### B8 — Estados visuales del nodo · ⬜ POR HACER

El CSS del nodo solo declara `--entry`, `--selected` y hover. No existen estados de **error**, **inválido**, **deshabilitado** ni **no ejecutable**. Este último importa: 9 de las 13 herramientas tienen `executable: false` y el dato ya está en el modelo (`isExecutableType()`), pero la interfaz no lo dice. Mostrarlo es aplicar la regla de no fingir funcionalidad.

#### B9 — Designar el nodo de entrada · ⬜ POR HACER

`mapCanvasToSnapshot` devuelve `version` sin tocar `entryNodeId`: **no hay forma de cambiar el nodo de entrada desde la UI**. El workspace se siembra con `start_message`; si el usuario borra ese nodo, el entry queda colgando y la publicación falla para siempre, sin camino de salida.

#### B10 — Gestión de automatizaciones · 🟡 EN PROGRESO

Funcionan: listar, crear, abrir, renombrar, borrar (con confirmación), buscar, estado vacío.

Pendientes, verificados en el menú contextual: **Duplicar** y **Archivar** aparecen en el menú pero `AutomationFlowCard` solo pasa `onRename` y `onDelete` → pulsarlos no hace nada. **Mover a…** está explícitamente `disabled`. Tres controles visibles sin comportamiento, contra la regla de no fingir funcionalidad.

Falta también: creación explícita (`POST /automations`) para retirar la escritura del `GET` del workspace y cerrar el hueco de autorización del `viewer` descrito en A3; carpetas más allá del listado; estados de la automatización (activa/pausada/archivada) en la tarjeta.

#### B12 — Responsive · 🟡 EN PROGRESO

Un único breakpoint en todo el builder (`max-width: 768px`, en topbar, modal de nodo y paleta): por debajo la paleta se oculta y no hay forma de añadir nodos. Falta decidir y validar el comportamiento en tablet y móvil, y revisar 1366 y 1024 con la topbar completa.

#### B13 — Accesibilidad · ⬜ POR HACER

Revisado parcialmente: el control de la Toolbox tiene `aria-label`, `title`, `aria-expanded` y `focus-visible`. Pendiente en el resto: los botones de acción del nodo son emoji con `title` pero sin `aria-label`; el canvas no tiene alternativa de teclado para crear o conectar nodos; falta revisar contraste de los textos secundarios sobre el cristal y el foco visible en la lista de herramientas.

#### B14 — Deuda de arquitectura frontend · 🟡 EN PROGRESO

**Corregido:**

- **Singleton mutable de módulo eliminado.** `editCallbackStore.ts` (una variable `let` de módulo) se sustituyó por `context/BuilderEditingContext.tsx`, que publica operaciones —no estado— en el árbol de React. Soporta varias instancias del builder a la vez, cosa que la variable global no podía. Verificado con un test que monta dos providers y comprueba que no se pisan.
- **Un solo dueño del estado de nodos.** `FlowNodeCard` ya no llama a `useReactFlow().setNodes/setEdges`: pide `removeNode(id)` por el contexto, y el coordinador compone `useCanvasNodes.removeNode` con `useCanvasEdges.removeEdgesOfNode`. Cada hook toca solo su propio estado. Ambas operaciones son estables (`useCallback`) para no re-renderizar el lienzo entero en cada cambio.
- **Autoguardado reconstruido** en tres responsabilidades separadas: `useDebouncedValue` (cuándo), `useDraftSync` (qué, en qué orden y cuál es el estado real) y `saveBuilderDraft` (por dónde). El debounce ahora es real —antes el propio cleanup emitía y convertía el autoguardado en un guardado por pulsación—, la firma de guardado avanza **solo** tras una respuesta correcta, un fallo marca `error` y nunca `saved`, no hay dos peticiones a la vez, un cambio que llega durante una petición se guarda como pendiente y sale después, y al desmontar se vuelca lo que quede sin guardar. 11 tests de comportamiento.
- **Controles muertos retirados.** El «Duplicar» del nodo (solo detenía la propagación) y los dos botones del pie de la Toolbox —«Centrar canvas» y «Reiniciar zoom», sin ningún manejador— salen de la interfaz. Encuadre y zoom ya existen en los `<Controls>` del propio lienzo.
- **CSS muerto eliminado.** `react-flow-overrides.css` se había convertido en el archivo donde caía cualquier parche del lienzo: se dividió por superficie (`canvas-surface`, `canvas-edges`, `canvas-controls`, `canvas-minimap`). Con ello desaparecen las reglas de hover y selección de edge, que el `style` en línea de React Flow anulaba y por tanto nunca se aplicaron, y los colores `#4f46e5` y `#22c55e` pasan a tokens (`--primary-hover`, `--chip-bg-hover`, `--line`, `--handle-valid`).
- **Cálculos descartados por render.** `buildStats` y `validateCanvasGraph` recorrían el grafo entero en cada render y su resultado se tiraba; ahora van memoizados sobre el grafo diferido. No se eliminan porque son la entrada de los paneles de B6.
- **Adaptadores protegidos.** `mapCanvasToSnapshot` / `mapSnapshotToCanvas` no tenían ningún test y son el punto exacto por donde puede perderse trabajo del usuario. 17 tests de ida y vuelta: posiciones, prioridad, condición, fallback, orden de ejecución, metadatos ajenos a la UI, tipos retirados y conexiones huérfanas.
- **Hueco de iconografía cerrado.** Una herramienta sin icono se pintaba sin él, en silencio. `listIconTypes()` permite comprobar la paridad entre definición e icono en ambos sentidos.

**Pendiente:**

- **Colores fuera del sistema de temas** en `flow-node.css` (`#6c5ce7`, `#9333ea` del nodo de entrada) y `node-editor-modal.css` (`#202c3f`, `#dbeafe`, `#dbe4f0`). No se tocan aquí porque el único reemplazo fiel —`--gradient-primary`, `--surface`, `--text`— tiene otros valores y **cambiaría el aspecto** de esas dos superficies. Es una decisión de diseño, y le corresponde a B8 (estados visuales del nodo) y a B5 (editor), no a un saneamiento estructural.
- **Realimentación visual de la conexión seleccionada**: al retirar el CSS muerto queda explícito que no existe. Corresponde a B7/B8, en la presentación del edge, no en una hoja de estilos.

#### B15 — Auditoría visual final y cierre · ⬜ POR HACER

Revisión completa con capturas de los dos temas, los tamaños de la lista de B12 y todos los estados de B7/B8, antes de declarar la fase cerrada.

### Criterio de cierre de la FASE B

La fase pasa a 🟢 COMPLETADA **solo** cuando se cumplan todos estos puntos:

1. Se puede configurar el comportamiento de las 13 herramientas desde la interfaz (B5).
2. No queda ningún componente construido sin consumidor ni estado producido y descartado (B6).
3. Todo estado del sistema se comunica con la verdad: guardado, error, sin publicar, inválido, no ejecutable (B7, B8).
4. Ningún control visible carece de comportamiento (B10, B14). — B14 ✅; **falta B10**: «Duplicar», «Archivar» y «Mover a…» en el menú de la lista de automatizaciones siguen sin comportamiento.
5. La estructura frontend es estable: una responsabilidad por módulo, sin mapas globales, sin singletons mutables, sin dos dueños del mismo estado (B14). — ✅ **cumplido**; queda solo el color fuera de tema de dos superficies, que depende de B5/B8.
6. Responsive validado en los tamaños acordados (B12) y accesibilidad revisada (B13).
7. `npm run check`, `npm --prefix apps/web run check`, `npm test`, `npm --prefix apps/web run test`, `npm run build`, `npm run build:web` y `git diff --check` en verde.
8. Revisión visual final con capturas de ambos temas (B15).

**Solo entonces se desbloquea la FASE C.**

---

## FASE C — Persistencia y Runtime real

**Estado: ⬜ POR HACER** — bloqueada por el cierre de la FASE B.

Objetivo: que un flow publicado se ejecute solo, sin depender del builder, sobre una persistencia que soporte más de un proceso y más de un desarrollador.

| Tarea | Descripción | Estado |
|---|---|---|
| C1 | Modelo de datos de automatizaciones en PostgreSQL/Neon: `Automation`, `AutomationDraft` (con `revision`), `AutomationVersion` inmutable, nodos y edges, carpetas. Decisión pendiente: nodos/edges como tablas propias o `jsonb` por versión | ⬜ POR HACER |
| C2 | Migrar `automations`/builder a `infrastructure/persistence/sql` — los puertos ya existen; no toca `domain/` ni `application/`. Retirar `persistence/json` de la ruta de producción | ⬜ POR HACER — depende de C1 |
| C3 | Transaccionalidad y aislamiento: publicar + actualizar catálogo en una transacción, borrado atómico (hoy `DeleteAutomationService` usa `Promise.all` sobre dos repositorios y su comentario promete una atomicidad que no tiene), `tenant_id` obligatorio e indexado en cada tabla | ⬜ POR HACER — depende de C2 |
| C4 | Lock optimista real usando `revision`, y validación de entrada en la API del builder: forma del body, forma del `flowKey`, límite de tamaño | ⬜ POR HACER — depende de C2 |
| C5 | Convertir en asíncrona la cadena de ejecución del motor (`ExecutionLoop`, `NodeRuntime`, `SessionStore`, `ContextWriter`). **Prerrequisito de todo lo demás de esta fase**: hoy el motor es síncrono de punta a punta y eso bloquea a la vez el nodo `ai`, cualquier nodo con I/O y las sesiones en SQL | ⬜ POR HACER |
| C6 | `infrastructure/queue` + contenido real en `apps/worker`: reanudar sesiones `delayed`, reintentos con política explícita, timeouts | ⬜ POR HACER — depende de C5 |
| C7 | Endpoint de recepción de eventos externos + implementar `flow-engine/triggers/TriggerResolver` (hoy es puerto sin cuerpo) + almacén de bindings + idempotencia por `messageId` (hoy una reentrega reejecuta) | ⬜ POR HACER — depende de C5 |
| C8 | Nodo `integration` real: ejecutor de efectos externos (hoy falla explícitamente con `integration_executor_not_implemented`) | ⬜ POR HACER — depende de C5 |
| C9 | Nodo `ai` conectado a un `AiProvider` real vía **OpenRouter**, detrás del puerto `flow-engine/ports/AiProvider.ts`. Es un tipo de nodo del grafo, **no** el AI Sales Engine | ⬜ POR HACER — depende de C5 |
| C10 | Implementar el comportamiento de ejecución de las 7 herramientas que hoy declaran `executable: false`: Etiquetas, Comprobante automático, Distribuidor, Pixel, Venta aprobada, Menú, Notificación. Cada una necesita especificación de negocio antes de implementarse | ⬜ POR HACER — depende de C5 y de sus dominios |
| C11 | Conectar `platform/security/rate-limiting` (implementado y probado) a `apps/api` | ⬜ POR HACER |
| C12 | Persistir ejecuciones (`Execution`, `ExecutionStep`) y conectar la observabilidad que ya existe sin consumidor, para poder auditar qué pasó en un flow | ⬜ POR HACER — depende de C6 |
| C13 | Corregir el hueco de autorización: `POST /automations` explícito y retirar la escritura del `GET .../workspace`, que hoy permite a un `viewer` crear automatizaciones sin cuota | ⬜ POR HACER — coordinado con B10 |

---

## FASE D — Canales y Conversations

**Estado: ⬜ POR HACER**

Objetivo: que un mensaje real de un canal real dispare un flow real y quede visible en un inbox.

| Tarea | Descripción | Estado |
|---|---|---|
| D1 | `domains/connections` — adaptador WhatsApp, Meta Cloud API primero (más estable que QR/WhatsApp Web) | ⬜ POR HACER — depende de C7 |
| D2 | `domains/connections` — adaptador Telegram | ⬜ POR HACER |
| D3 | `domains/conversations` — inbox mínimo: lista, hilo, estado, contacto asociado | ⬜ POR HACER |
| D4 | Cierre del ciclo: canal → `ExternalEvent` → `TriggerResolver` → flow-engine → sesión visible en Conversations | ⬜ POR HACER — depende de D1 y D3 |

Recordatorio de frontera: `sessions` es el estado de ejecución del runtime; `conversations` es el inbox operacional. Son contextos distintos y no deben fusionarse.

---

## FASE E — AI Agents + AI Sales Engine

**Estado: ⬜ POR HACER**

> El AI Sales Engine se abordará posteriormente en esta fase específica. Antes de integrarlo se realizará una auditoría profunda de su arquitectura, responsabilidades, dependencias, memoria, configuración, comportamiento comercial, multi-tenancy, persistencia, puntos de integración y escalabilidad. No debe modificarse durante las fases anteriores salvo dependencia explícitamente aprobada.

**No se asume todavía la estrategia de incorporación.** Si será paquete, módulo, servicio, submódulo, adaptador u otra cosa se decide **después** de la auditoría E0, con datos y no con suposiciones.

No depende de ninguna fase anterior para abrirse, y ninguna fase anterior depende de ella — es deliberadamente independiente del resto del roadmap.

| Tarea | Descripción | Estado |
|---|---|---|
| E0 | Auditoría profunda del AI Sales Engine: arquitectura, responsabilidades, dependencias, memoria, configuración, comportamiento comercial, multi-tenancy, persistencia, integración y escalabilidad | ⬜ POR HACER |
| E1 | Decisión de ubicación y estrategia de incorporación, derivada de E0 | ⬜ POR HACER — depende de E0 |
| E2 | Puerto en `domains/ai-agents/application/` con lo que la plataforma necesita del motor | ⬜ POR HACER — depende de E1 |
| E3 | Adaptador en `domains/ai-agents/infrastructure/` que traduzca entre conceptos de plataforma (tenant, plan, canal, activación) y la API del motor | ⬜ POR HACER — depende de E2 |
| E4 | Persistencia de activación y configuración del agente por tenant | ⬜ POR HACER — depende de E2 |
| E5 | Conectar `apps/web/src/features/ai-agents/AiAgentsPage.tsx` a HTTP real | ⬜ POR HACER — depende de E2-E4 |

Reglas de frontera ya acordadas y vigentes: solo `domains/ai-agents` habla con el motor; la relación es unidireccional; la plataforma depende del puerto y no de los internals; el **handoff a un asesor humano pertenece al motor**, no al Flow Engine. El nodo `ai` del flow-engine (C9) es un concepto **distinto** y no debe fusionarse con esto.

---

## FASE F — SaaS, Usage y Billing

**Estado: ⬜ POR HACER**

| Tarea | Descripción | Estado |
|---|---|---|
| F1 | Medición de consumo real en `domains/billing` (usage no vive en `platform/` por decisión ya tomada) | ⬜ POR HACER — depende de C12 |
| F2 | Aplicar límites de plan (`domains/billing/limits`) sobre endpoints reales, incluidas cuotas de automatizaciones por tenant | ⬜ POR HACER — depende de F1 |
| F3 | Exponer `domains/billing` en `apps/api` (hoy sin endpoint) | ⬜ POR HACER |
| F4 | Gestión de equipo más allá del alta inicial: invitar, remover, cambiar rol de miembros | ⬜ POR HACER |
| F5 | Integración de pasarela de pago concreta bajo `infrastructure/providers` | ⬜ POR HACER |

---

## FASE G — Producto visual restante

**Estado: ⬜ POR HACER**

Las áreas del sidebar que siguen sin implementación. Dependen de que las fases anteriores generen datos reales que mostrar — construirlas antes produce vistas vacías sin valor de validación.

| Tarea | Descripción | Estado |
|---|---|---|
| G1 | Dashboard — depende de D y F teniendo actividad real | ⬜ POR HACER |
| G2 | Contactos (`domains/contacts`) | ⬜ POR HACER |
| G3 | Integraciones (`domains/integrations`) | ⬜ POR HACER |
| G4 | Mi perfil | ⬜ POR HACER |
| G5 | Configuración — incluida la pantalla de seguridad que usará `passwordClient.change`, ya implementado en el cliente | ⬜ POR HACER |
| G6 | Ayuda | ⬜ POR HACER |

---

## FASE H — Producción y Escalabilidad

**Estado: ⬜ POR HACER**

| Tarea | Descripción | Estado |
|---|---|---|
| H1 | Registrar dominio de producción en Neon Auth (`neonctl neon-auth domain add`) — bloqueante para autenticar en producción | ⬜ POR HACER |
| H2 | Remitente de correo propio (SMTP verificado) en Neon, sustituyendo el compartido de desarrollo | ⬜ POR HACER |
| H3 | Despliegue: frontend en Vercel, API en infraestructura adecuada a un proceso `node:http` de larga duración (Vercel no aplica igual a un servidor con estado de conexión persistente) | ⬜ POR HACER |
| H4 | Conectar el resto de observabilidad ya implementada (auditoría, métricas, tracing — hoy `PREPARADO` sin consumidor) | ⬜ POR HACER |
| H5 | Tests end-to-end de navegador (hoy no existen; la cobertura es unitaria + integración de API + componentes aislados) | ⬜ POR HACER |
| H6 | Ciclo de vida de usuario eliminado en Neon Auth: `memberships.user_id` no tiene FK y no hay webhook `user.deleted`, así que borrar un usuario puede dejar memberships huérfanas | ⬜ POR HACER |
| H7 | Revisar particionado/escala de `persistence/sql` si el volumen de tenants lo exige | ⬜ POR HACER |

---

## Regla de actualización

Cada vez que se cierra una tarea:

1. Actualizar su estado en este archivo.
2. Añadir una nota breve de qué se hizo.
3. Registrar cómo se validó (build, typecheck, tests concretos).
4. Registrar los tests relevantes que la cubren.
5. Indicar qué dependencias quedan desbloqueadas para la siguiente tarea.
6. Este archivo debe reflejar **siempre** el estado real del repositorio — nunca se actualiza para aparentar avance.

---

## Historial

| Fecha | Cambio |
|---|---|
| 2026-08-31 | Creación del roadmap. Auditoría arquitectónica completa registrada (A3, 🟢). Fase A ejecutada: A1 🟢 (3 documentos corregidos, validado con `check`/`test`/`build` en backend y frontend — 261+147 tests sin tocar ninguno, builds limpios), A2 🔴 (decisión de ubicación del AI Sales Engine pendiente del usuario), A4 🟢 (reglas permanentes fijadas). Fase A queda cerrada salvo A2, que depende de una decisión externa. |
| 2026-08-31 | Corrección de planificación: el AI Sales Engine no se integra ahora — decisión de producto ya tomada de abordarlo en una fase propia, con su propia auditoría previa, sin bloquear el resto del roadmap. A2 pasa de 🔴 BLOQUEADO a ⬜ POR HACER, sin investigar estrategia de incorporación todavía. Fase A queda 🟢 COMPLETADA en su totalidad. Sin cambios de código — solo `ROADMAP.md`. |
| 2026-09-01 | Trabajo de producto sobre Automatizaciones, registrado en B2, B3 y B4: retirada de 4 herramientas del catálogo con migración de sus capacidades, incorporación de las 7 que faltaban hasta las 13 oficiales, arquitectura modular de `tools/` con registry como única frontera, Toolbox convertida en overlay flotante con cristal y plegado vertical, canvas recuperando el ancho completo del área de trabajo, conexiones Bézier flexibles, retirada visual de la prioridad e identidad azul→violeta de las conexiones. Validado en cada paso con typecheck, 264 tests de backend, 172 de frontend y ambos builds. |
| 2026-09-01 | **Auditoría y reorganización del roadmap.** Se auditó de nuevo este documento contra el repositorio real, no contra lo que decía de sí mismo. Se corrigió el orden de fases a la secuencia oficial A–H: Automatizaciones visual pasa a ser la **FASE B**, y Persistencia + Runtime se desplaza a la **FASE C**; canales a D, AI a E, billing a F, producto visual restante a G, producción a H. Se separó explícitamente «Builder base» (🟢) de «Automatizaciones — experiencia visual completa» (🟡), que antes se confundían en una sola fila y hacían parecer terminado un módulo que no puede configurar sus nodos. Se desglosó la FASE B en 15 tareas derivadas de verificación en código —no inventadas— con criterio de cierre explícito. Se registraron en A3 los hallazgos de la auditoría del módulo. Se mantiene el AI Sales Engine reservado a su fase propia (E) con auditoría previa obligatoria y sin decidir aún su estrategia de incorporación. Se conservó íntegro el detalle técnico previo. Sin cambios de código — solo `ROADMAP.md`. |
| 2026-09-01 | **B11 — Topbar del builder cerrada.** Tarjeta flotante de cristal con volver, nombre editable en línea (`FlowNameEditor`) y pastilla de estado (`SaveStatusPill`). Se retiraron `Publicar`, `v1` y `Rollback`: el modelo es editar → autoguardar, y esas capacidades siguen intactas fuera de la topbar hasta que B6 monte los paneles. Toolbox compactada en dos pasadas y arrancando recogida. Registrado también **B16**: encuadre inicial del lienzo y rediseño del minimapa. |
| 2026-09-01 | **B14 — Saneamiento arquitectónico del builder.** Eliminado el singleton mutable `editCallbackStore` en favor de `BuilderEditingContext`; `FlowNodeCard` deja de ser un segundo dueño del estado del grafo y pide `removeNode` por la frontera; autoguardado reconstruido en `useDebouncedValue` + `useDraftSync` con estado que no miente, sin peticiones concurrentes y con volcado al desmontar; retirados los tres controles visibles sin comportamiento; `react-flow-overrides.css` dividido por superficie con sus reglas muertas y colores fuera de tema eliminados; `buildStats` y `validateCanvasGraph` memoizados. Cobertura nueva donde no había ninguna: 17 tests de ida y vuelta de los adaptadores —la frontera que protege el trabajo del usuario—, 11 del autoguardado, 4 de la frontera de edición y 3 de paridad catálogo ↔ iconografía. Validado con typecheck, 264 tests de backend, 238 de frontend y ambos builds. |
