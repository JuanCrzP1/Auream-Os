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
FASE B  Automatizaciones — producto visual        🟢 COMPLETADA
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
| **Automations — experiencia visual completa** | 🟢 COMPLETADO | FASE B cerrada (2026-11-08): 12 herramientas con editor, bloque de inicio, revisión del flujo, estados de bloque, gestión completa, responsive y accesibilidad. Ejecución real: FASE C |
| Toolbox (paleta de herramientas) | 🟢 COMPLETADO | Overlay flotante, cristal, plegado vertical, 12 herramientas, búsqueda, iconos propios |
| Arquitectura modular de herramientas | 🟢 COMPLETADO | `builder/tools/` con registry puro como única frontera; grafo de imports acíclico |
| Conexiones del canvas | 🟢 COMPLETADO | Bézier flexible, identidad azul→violeta, sin rótulo de prioridad |
| Topbar del builder | 🟢 COMPLETADO | Tarjeta flotante: volver, nombre editable en línea, pastilla de guardado. Sin publicar/versión/rollback |
| Lienzo: encuadre y minimapa | 🟢 COMPLETADO | Encuadre inicial alejado; minimapa de cristal por las variables de React Flow, sin marco gris |
| Autoguardado | 🟢 COMPLETADO | Debounce real, sin peticiones concurrentes, estado fiable, volcado al desmontar. Frontera lista para el bloqueo optimista de la FASE C |
| Frontera de edición del builder | 🟢 COMPLETADO | `BuilderEditingContext`; sin singletons mutables y con un solo dueño del estado del grafo |
| Editor de configuración de nodo | 🟢 COMPLETADO (visual) | Las 12 herramientas tienen editor propio sobre el kit `tools/_kit/`; ejecución pendiente (Fase C) |
| Paneles del builder | 🟢 COMPLETADO | Revisión del flujo en el lienzo (`reviewFlow` + `FlowReviewPanel`); retirados los paneles obsoletos y todo el circuito de publicación (B6). El simulador pasa a C15 |
| Bloque de inicio | 🟢 COMPLETADO | Tipo de sistema `start` como en Leona, con migración de los flujos antiguos al leer (B9) |
| Estados del builder | 🟢 COMPLETADO | Guardado fiable (B14), aviso y estado «Sin conexión» con «Reintentar», problemas del flujo visibles (B7). Los estados visuales de cada nodo son B8 |
| Gestión de automatizaciones | 🟢 COMPLETADO | Listar, crear (explícito, sin hueco de permisos), abrir, renombrar, duplicar, mover, archivar/restaurar, borrar y buscar (B10) |
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
- **Un módulo puro no puede depender de React.** `tools/registry.ts` y `services/reviewFlow.ts` los ejecuta también el test de paridad del backend: un icono en esa cadena rompe la ejecución.
- Legacy sin uso — código muerto no se conserva "por si acaso". El caso de `JWT_SECRET` detectado en A1 (scripts/tests que lo referencian sin que nada lo lea) queda registrado como deuda a limpiar en la primera tarea de código que toque esos archivos por otra razón — no se abre una tarea exclusiva solo para eso, para no violar la regla siguiente.
- Modificar un módulo estable (`automations`, `flow-engine`, `platform/identity`, `platform/authorization`, el login) sin una razón demostrable y documentada en este roadmap.

---

## FASE B — Automatizaciones: producto visual completo

**Estado: 🟢 COMPLETADA (2026-11-08)**

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
- 12 herramientas con búsqueda por etiqueta y descripción, iconos propios y nombres sin truncar.
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

#### B5 — Editor de configuración por herramienta · 🟢 COMPLETADO (visual) — **la tarea central de esta fase**

Cada herramienta declara su editor, cuerpo compacto, validación y resumen en su propio módulo, descubiertos por el registry. Arquitectura y convenciones en [`builder-tools.md`](docs/architecture/builder-tools.md).

- 🟢 Las 12 herramientas tienen editor propio (2026-11-08), con paridad funcional con los bloques equivalentes de Leona y el estilo de Auream: Mensaje, Esperar respuesta, Programador, Distribuidor, Condicional, Menú, Etiquetas, Integración, Notificación, Pixel, Extensión IA y Comprobante automático. «Venta aprobada» se retiró del catálogo (2026-11-08).
- ⬜ Solo visual: ninguna de las nuevas se ejecuta todavía (`executable` lo declara). Conectarlas al motor es Fase C.
- 🟢 Base para escalar (2026-11-08): contrato `outputs()` para salidas con nombre (con poda de aristas huérfanas en el núcleo), kit compartido `tools/_kit/` (Switch, OutputHandle, useAutoHeight, createLocalId), ids de arista únicos, código en inglés y comentarios concisos.
- En la práctica las cuatro herramientas usan editores a medida sobre el kit compartido. Sigue abierta la decisión formal «esquema declarativo vs. a medida».

#### B6 — Paneles del builder · 🟢 COMPLETADO (2026-11-08)

Verificado por grep: `NodeInspector`, `EdgeInspector`, `ValidationPanel`, `SimulationPanel`, `ReleasePanel` y `CanvasHintBar` tienen **0 consumidores**. Y lo que producen tampoco se consume: `builder.validation`, `builder.stats`, `builder.selectedNode`, `builder.selectedEdge`, `builder.simulationLog` y `handleSimulate` tienen **0 usos en TSX**.

**Auditoría (2026-11-08): no se montan todos.** Con los 12 editores en el lienzo y las conexiones por salida, la mitad quedó obsoleta:

| Pieza | Decisión | Motivo |
|---|---|---|
| `NodeInspector` | Retirar | Edita nombre y un textarea: lo sustituyen los editores de cada herramienta. |
| `EdgeInspector` | Retirar | Prioridad, condición y fallback por arista es el modelo anterior; se enruta por salidas ([flow-connections.md](docs/architecture/flow-connections.md)). |
| `CanvasHintBar` | Retirar | Tres frases fijas, sin función. |
| `ValidationPanel` | Rediseñar y montar | `validateCanvasGraph` debe devolver problemas estructurados (`code`, `severity`, `nodeId`), sumar la validación de cada herramienta (`validate()`) y llevar al bloque al hacer clic. |
| `ReleasePanel` | Retirar, junto con todo el circuito de publicación | **Decisión de producto (2026-11-08): los flujos no se publican.** Se autoguardan y lo guardado es lo que corre; el estado es activo/archivado, como en Leona. |
| `SimulationPanel` | Pasa a la FASE C (C15) | El motor aún no enruta por salida (C14) y 8 herramientas no se ejecutan: hoy un simulador mostraría un recorrido falso. |

**Hecho:**

- **Revisión del flujo.** `services/reviewFlow.ts` sustituye a `validateCanvasGraph`: devuelve problemas estructurados (`code`, `severity`, `nodeId`, id estable), con las reglas del grafo en paridad con `GraphValidator` (12 + 3 escenarios), la configuración de cada bloque (`validate()` de la herramienta) y las salidas sin conectar. `FlowReviewPanel` la muestra en la esquina superior derecha del lienzo: resumen siempre visible, lista desplegable y clic para encuadrar y seleccionar el bloque. Solo informa.
- **Retirados:** `NodeInspector`, `EdgeInspector`, `CanvasHintBar`, `ValidationPanel`, `ReleasePanel`, `buildStats` y su CSS; `useBuilderPublishing` y los servicios de publicar/rollback; en el backend `PublishDraftService`, `RollbackDraftService`, sus handlers y rutas, y `publishedSnapshots` del contrato (se descarta al leer). El scope `flows.publish` queda reservado para asignar un flujo a una conexión (D1).

#### B7 — Estados del builder y de guardado · 🟢 COMPLETADO (2026-11-08)

Defectos verificados, todos de experiencia:

- ~~Un guardado fallido se muestra como «Guardado».~~ **Corregido en B14**: `SaveStatusPill` distingue los cuatro estados y `useDraftSync` solo marca guardado tras una respuesta correcta.
- ~~Si la API no responde, el usuario edita creyendo que guarda.~~ **Corregido**: la carga dice si viene del servidor (`persisted`); si no, la cápsula muestra «Sin conexión», un aviso fijo explica que nada se guardará, el autoguardado no se intenta y «Reintentar» vuelve a montar el builder desde cero (lo editado sin conexión nunca se guarda encima del flujo real).
- ~~Publicar un grafo inválido no informa de nada.~~ **Ya no aplica**: los flujos no se publican (ver B6). La validación informa en el panel de revisión, no bloquea.
- ~~Resultado de validación visible y herramienta no soportada.~~ **Corregido en B6**: la revisión del flujo lo muestra, con `unknown-tool` para tipos retirados.

#### B8 — Estados visuales del nodo · 🟢 COMPLETADO (2026-11-08)

Cada bloque dice su estado en el propio lienzo, sin abrir nada:

- **Error / aviso:** se probó un anillo y una marca por bloque y se **retiró por decisión de producto** (2026-11-08): saturaba el lienzo sin aportar más que la revisión del flujo, que ya lista cada problema y lleva al bloque. El lienzo queda limpio.
- **No ejecutable:** pestaña «Próximamente» en las 8 herramientas con `executable: false`. Se configuran, pero aún no corren con clientes (FASE C).
- «Deshabilitado» no aplica: no existe ese concepto en el producto.

#### B9 — Bloque de inicio · 🟢 COMPLETADO (2026-11-08)

El riesgo descrito originalmente (borrar el inicio) ya lo cerraba `entryNodeProtection`. La auditoría encontró el defecto real: el inicio era un nodo `message` con el texto «Inicio del flujo», que el motor **habría enviado a cada cliente**. Se corrigió con el mismo modelo que Leona:

- Tipo de sistema `start` (`contracts/FlowEntry.ts`): uno por flujo, fuera de la paleta, no se borra, duplica ni edita, una sola salida. `StartNodeHandler` pasa al siguiente bloque sin enviar nada.
- Migración al leer (`ensureStartEntry`) aplicada por el decorador `UpgradingBuilderWorkspaceRepository`: toda lectura sale migrada, sea cual sea la base de datos. Repara también flujos con la entrada colgando (había 1 en los datos locales).
- Validación: `validateStartBlock` (`ENTRY_NODE_NOT_START`, `START_NODE_NOT_ENTRY`, `ENTRY_HAS_INCOMING`), con paridad en el builder (3 escenarios nuevos).
- `mapCanvasToSnapshot` deriva `entryNodeId` del nodo marcado en el lienzo.
- Retirado el modal genérico `NodeEditorModal`: los nodos sin editor (Inicio, Finalizar) ya no se abren ni ofrecen el lápiz.

#### B10 — Gestión de automatizaciones · 🟢 COMPLETADO (2026-11-08)

Ningún control del menú queda sin comportamiento:

- **Duplicar** (`POST /automations/:id/duplicate`, `DuplicateAutomationService`): copia completa del borrador con id y nombre nuevos («(copia)»), en la misma carpeta; nace como borrador.
- **Archivar / Restaurar** (`PATCH /automations/:id/archive`, `SetAutomationArchivedService`): la archivada sale de la vista normal y de los conteos y queda en una sección «Archivadas» plegada; restaurar la devuelve como borrador.
- **Mover a…**: diálogo para elegir carpeta o «Sin carpeta», accesible con teclado; usa el mismo caso de uso que el arrastre.
- **Creación explícita** (`POST /automations`, `CreateAutomationService`, `flows.write`): el id lo decide el servidor y, dentro de una carpeta, nace en ella. **Cerrado el hueco de autorización de A3/C13**: abrir el builder (`GET` del workspace) ya no escribe nada; un id desconocido es 404.
- Errores de dominio 404 con `NotFoundError`. Tests: casos de uso, autorización por ruta (solo lectura → 403) y recorrido completo del hub con una API falsa que persiste.

Queda fuera, para más adelante: carpetas anidadas y estado activo/pausado en la tarjeta (llega con las conexiones, FASE D).

#### B12 — Responsive · 🟢 COMPLETADO (2026-11-08)

Validado con emulación real de dispositivo en 1440, 1024, 768 (tablet) y 390 (celular), en los dos temas:

- **El menú lateral de la aplicación** (220px fijos, sin ninguna regla responsive) no se adaptaba nunca: en un celular dejaba ~158px al builder. Dentro del builder se oculta por debajo de 768px; «Volver a automatizaciones» queda en la topbar. El menú del resto de la aplicación en móvil es de la FASE G.
- **La Toolbox ya no se oculta** en pantallas pequeñas (era la única forma de añadir bloques): arranca plegada y, abierta, no pasa del ancho disponible.
- **Añadir con un toque** coloca el bloque en el centro de lo que se está viendo (`registerViewportCenter`), no en una posición fija fuera de la pantalla.
- **El editor del bloque** cabe en la pantalla (`min(560px, 100vw − 16px)`, alto completo en celular); la topbar, la revisión (solo icono y contadores) y los avisos se compactan. Los avisos centrados dejaron de usar `left: 50%`, que partía el texto palabra por palabra.
- **Encuadre inicial corregido** (defecto previo, visible en cualquier tamaño): el `fitView` se aplicaba antes de medir los bloques y solo encuadraba Inicio. Ahora se repite una vez con todos medidos (`useNodesInitialized`).

#### B13 — Accesibilidad · 🟢 COMPLETADO (2026-11-08)

- **Teclado en el lienzo:** Tab recorre los bloques (foco visible), Enter abre el editor del bloque enfocado, Suprimir lo borra y Escape cierra el editor. El lienzo se anuncia con instrucciones (`aria-label`).
- **Toolbox:** buscador con nombre accesible; cada herramienta se anuncia «Añadir …» y se añade con Enter; foco visible.
- **Ya cubierto en tareas anteriores:** acciones del bloque con `aria-label`, revisión del flujo y marcas de estado anunciadas a lectores de pantalla, avisos con `role="status"`/`"alert"`, `prefers-reduced-motion` en las animaciones, contraste mínimo vigilado por test en la paleta de herramientas.
- **Limitación conocida:** crear conexiones sigue requiriendo puntero (React Flow no ofrece conexión por teclado). Se registra para la FASE G.

#### B14 — Deuda de arquitectura frontend · 🟢 COMPLETADO (2026-11-08)

**Corregido:**

- **Singleton mutable de módulo eliminado.** `editCallbackStore.ts` (una variable `let` de módulo) se sustituyó por `context/BuilderEditingContext.tsx`, que publica operaciones —no estado— en el árbol de React. Soporta varias instancias del builder a la vez, cosa que la variable global no podía. Verificado con un test que monta dos providers y comprueba que no se pisan.
- **Un solo dueño del estado de nodos.** `FlowNodeCard` ya no llama a `useReactFlow().setNodes/setEdges`: pide `removeNode(id)` por el contexto, y el coordinador compone `useCanvasNodes.removeNode` con `useCanvasEdges.removeEdgesOfNode`. Cada hook toca solo su propio estado. Ambas operaciones son estables (`useCallback`) para no re-renderizar el lienzo entero en cada cambio.
- **Autoguardado reconstruido** en tres responsabilidades separadas: `useDebouncedValue` (cuándo), `useDraftSync` (qué, en qué orden y cuál es el estado real) y `saveBuilderDraft` (por dónde). El debounce ahora es real —antes el propio cleanup emitía y convertía el autoguardado en un guardado por pulsación—, la firma de guardado avanza **solo** tras una respuesta correcta, un fallo marca `error` y nunca `saved`, no hay dos peticiones a la vez, un cambio que llega durante una petición se guarda como pendiente y sale después, y al desmontar se vuelca lo que quede sin guardar. 11 tests de comportamiento.
- **Controles muertos retirados.** El «Duplicar» del nodo (solo detenía la propagación) y los dos botones del pie de la Toolbox —«Centrar canvas» y «Reiniciar zoom», sin ningún manejador— salen de la interfaz. Encuadre y zoom ya existen en los `<Controls>` del propio lienzo.
- **CSS muerto eliminado.** `react-flow-overrides.css` se había convertido en el archivo donde caía cualquier parche del lienzo: se dividió por superficie (`canvas-surface`, `canvas-edges`, `canvas-controls`, `canvas-minimap`). Con ello desaparecen las reglas de hover y selección de edge, que el `style` en línea de React Flow anulaba y por tanto nunca se aplicaron, y los colores `#4f46e5` y `#22c55e` pasan a tokens (`--primary-hover`, `--chip-bg-hover`, `--line`, `--handle-valid`).
- **Cálculos descartados por render.** `buildStats` y `validateCanvasGraph` recorrían el grafo entero en cada render y su resultado se tiraba; ahora van memoizados sobre el grafo diferido. No se eliminan porque son la entrada de los paneles de B6.
- **Adaptadores protegidos.** `mapCanvasToSnapshot` / `mapSnapshotToCanvas` no tenían ningún test y son el punto exacto por donde puede perderse trabajo del usuario. 17 tests de ida y vuelta: posiciones, prioridad, condición, fallback, orden de ejecución, metadatos ajenos a la UI, tipos retirados y conexiones huérfanas.
- **Hueco de iconografía cerrado.** Una herramienta sin icono se pintaba sin él, en silencio. `listIconTypes()` permite comprobar la paridad entre definición e icono en ambos sentidos.

**Cerrado también (2026-11-08):**

- **Colores de la píldora de Inicio** pasan a tokens del tema (`--entry-start`, `--entry-end`), con el mismo aspecto; sus sombras se derivan con `color-mix`.
- **Conexión seleccionada:** trazo más grueso y con halo, decidido en `DeletableEdge` (su `style` en línea gana a cualquier hoja).

#### B15 — Auditoría visual final y cierre · 🟢 COMPLETADO (2026-11-08)

Capturas con emulación real de dispositivo de la composición real del builder (menú lateral, topbar, Toolbox, lienzo, revisión, editor y avisos) en escritorio 1440, 1024, tablet 768 y celular 390, temas oscuro y claro, con todos los estados: flujo con errores y avisos, «Próximamente», revisión abierta, editor abierto, Toolbox abierta, sin conexión y conexión seleccionada. Lo que la auditoría encontró se corrigió en B12 (encuadre inicial, avisos partidos, menú lateral). Verificación final: `check` y `test` de backend y web, `build`, `build:web`, `git diff --check` y el escenario en Chrome real, todo en verde.

### Criterio de cierre de la FASE B

La fase pasa a 🟢 COMPLETADA **solo** cuando se cumplan todos estos puntos:

1. Se puede configurar el comportamiento de las 12 herramientas desde la interfaz (B5). — ✅ **cumplido**.
2. No queda ningún componente construido sin consumidor ni estado producido y descartado (B6). — ✅ **cumplido**; `SimulationPanel` queda reservado a C15 de forma explícita.
3. Todo estado del sistema se comunica con la verdad: guardado, error, sin conexión, inválido, no ejecutable (B7, B8). — ✅ **cumplido**.
4. Ningún control visible carece de comportamiento (B10, B14). — ✅ **cumplido**.
5. La estructura frontend es estable: una responsabilidad por módulo, sin mapas globales, sin singletons mutables, sin dos dueños del mismo estado (B14). — ✅ **cumplido**.
6. Responsive validado en los tamaños acordados (B12) y accesibilidad revisada (B13). — ✅ **cumplido**.
7. `npm run check`, `npm --prefix apps/web run check`, `npm test`, `npm --prefix apps/web run test`, `npm run build`, `npm run build:web` y `git diff --check` en verde. — ✅ **cumplido** (414 + 1537 tests).
8. Revisión visual final con capturas de ambos temas (B15). — ✅ **cumplido**.

**✅ Los 8 puntos se cumplen: FASE B COMPLETADA (2026-11-08). La FASE C queda desbloqueada.**

---

## FASE C — Persistencia y Runtime real

**Estado: ⬜ POR HACER** — desbloqueada (FASE B cerrada el 2026-11-08). Primero C1 y C2: los flujos a PostgreSQL/Neon por cuenta.

Objetivo: que un flow activo se ejecute solo (lo último guardado; no hay publicación, ver B6), sin depender del builder, sobre una persistencia que soporte más de un proceso y más de un desarrollador.

| Tarea | Descripción | Estado |
|---|---|---|
| C1 | Modelo de datos de automatizaciones en PostgreSQL/Neon: `automations`, `automation_drafts` (documento `jsonb` por flujo, con `revision`), `automation_folders`. **Decidido:** documento por flujo (2026-11-08) | 🟢 COMPLETADO — `004_automations.sql`, aplicada en la rama test |
| C2 | Migrar `automations`/builder a `infrastructure/persistence/sql` — los puertos ya existen; no toca `domain/` ni `application/`. Retirar `persistence/json` de la ruta de producción | 🟢 COMPLETADO en desarrollo/test (2026-11-08): repositorios SQL, 8 tests de integración en Neon, producción solo acepta `sql`, importación verificada (10/10 flujos idénticos) y el entorno local ya trabaja contra la base (`AUTOMATIONS_STORE=sql`, rama test). **Producción:** la credencial no vive en los equipos de desarrollo; `db:migrate:prod` + `db:import-automations:prod` se ejecutan al desplegar (FASE H) |
| C3 | Transaccionalidad y aislamiento: guardar borrador + catálogo, crear, duplicar y borrar en una transacción; `tenant_id` obligatorio e indexado | 🟢 COMPLETADO (2026-11-08) — puerto `AutomationsUnitOfWork` en el dominio; `SqlAutomationsUnitOfWork` = transacción real (rollback probado en Neon); `DirectUnitOfWork` para archivos/pruebas. FK con cascada entre catálogo y borrador |
| C4 | Lock optimista real usando `revision`, y validación de entrada en la API del builder | 🟢 COMPLETADO (2026-11-08) — `baseRevision` en cada guardado; en SQL comprobar y escribir es UNA sentencia (carrera probada: solo entra una); 409 → el builder deja de guardar y ofrece recargar. Entrada: tope de 2 MB (413), JSON inválido 400, forma del flujo y del `flowKey` 400, identidad del flujo fijada por el servidor |
| C5 | Convertir en asíncrona la cadena de ejecución del motor (`ExecutionLoop`, `NodeRuntime`, `SessionStore`, `ContextWriter`) | 🟢 COMPLETADO (2026-11-08) — handlers, `NodeRuntime`, loop, orquestador, `FlowExecutor`, `SessionStore`, `FlowRegistry`, `TenantContextResolver` y la simulación, asíncronos. `ContextWriter` queda síncrono a propósito (transformación pura). Prueba de punta a punta por la cadena real de la API |
| C6 | `infrastructure/queue` + contenido real en `apps/worker`: reanudar sesiones `delayed`, reintentos con política explícita, timeouts | 🟢 COMPLETADO (2026-11-09) — cola genérica en Neon (`domains/scheduling`, `019_scheduled_tasks.sql`): reserva atómica `for update skip locked` con reservas que caducan, reintentos espaciados (30 s → 1 h, 5 intentos), errores definitivos, limpieza; despertadores de los flujos: el motor declara `wakeUp` (Programador con espera/fecha/horario en la zona del negocio, «Tiempo agotado» de Esperar respuesta y Menú, pausas de un Mensaje que no caben en 20 s por turno) y descarta los vencidos por revisión; `FlowTurn` único para mensaje, envío a mano y despertador; `/internal/tasks/run` con `CRON_SECRET` (Vercel Cron + autoinvocación para lo que vence en segundos + revisión en cada mensaje); `apps/worker` y servidor local con rondas. Ver docs/architecture/task-queue.md |
| C7 | Endpoint de recepción de eventos externos + implementar `flow-engine/triggers/TriggerResolver` (hoy es puerto sin cuerpo) + almacén de bindings + idempotencia por `messageId` (hoy una reentrega reejecuta) | ⬜ POR HACER — depende de C5 |
| C8 | Nodo `integration` real: ejecutor de efectos externos (hoy falla explícitamente con `integration_executor_not_implemented`) | ⬜ POR HACER — depende de C5 |
| C9 | Nodo `ai` conectado a modelos reales (**OpenAI, Gemini y OpenRouter**) detrás del puerto `flow-engine/ports/AiGateway.ts`. Es un tipo de nodo del grafo, **no** el AI Sales Engine | 🟢 COMPLETADO (2026-11-08) — conexiones de IA por cuenta con clave cifrada (AES-256-GCM), verificadas con el proveedor; el bloque responde, recuerda la conversación y clasifica intención; «Probar» en el editor |
| C10 | Implementar el comportamiento de ejecución de las herramientas que hoy declaran `executable: false`. Cada una con su contrato de configuración compartido (`contracts/*Config.ts`) | 🟢 COMPLETADO (2026-11-09) — **Notificación** (aviso por WhatsApp al número del equipo, por el mismo número conectado del chat, como en Leona) cierra las 12 herramientas. Antes: **Condicional, Menú, Distribuidor, Etiquetas, Integración, Extensión IA, Pixel y Comprobante automático funcionando** (2026-11-08, con contadores atómicos en PostgreSQL, módulo de Contactos, cliente HTTP con protección SSRF, OCR propio y simulación de punta a punta). |
| C11 | Conectar `platform/security/rate-limiting` (implementado y probado) a `apps/api` | 🟢 COMPLETADO (2026-11-09) — cuenta compartida en Neon (`SqlRateLimiter`, `022_rate_limits.sql`): 1.200/min por cuenta y 300/min por IP sin sesión válida; 429 con `Retry-After`; los botones de prueba y subidas usan la misma cuenta; si la base falla, deja pasar |
| C12 | Persistir ejecuciones (`Execution`, `ExecutionStep`) y conectar la observabilidad que ya existe sin consumidor, para poder auditar qué pasó en un flow | 🟢 COMPLETADO (2026-11-09) — historial INTERNO (sin pantalla, decidido por el dueño): cada turno en `flow_turn_log` (`023`, 14 días) y una línea `flow.turn` en el registro; `scripts/ops/flow-history.mjs` muestra la línea de tiempo de un chat. Ver `docs/operations/flow-history.md` |
| C13 | ~~Corregir el hueco de autorización: `POST /automations` explícito y retirar la escritura del `GET .../workspace`~~ | 🟢 COMPLETADO en B10 (2026-11-08) |
| C14 | Enrutar por salida en el motor: `fromOutput` viaja al snapshot de ejecución, cada handler declara por qué salida sigue y `EdgeEvaluator` sigue esa salida | 🟢 COMPLETADO (2026-11-08) — `FlowEdge.fromOutput`, `NodeExecutionResult.output`, `EdgeEvaluator` con decisión explícita; salida sin conectar = fin limpio de la rama. «Esperar respuesta» ya sale por `respuesta`; el resto de bloques declara su salida al implementarse (C10) y `tiempo-agotado` llega con C6 |
| C15 | Simulador en el builder | 🟢 COMPLETADO (2026-11-10) — **Laboratorio de pruebas** propio (no imita el de Leona): «Probar» en el editor abre un panel flotante con Conversación (escribir como el cliente, tocar opciones de menú, «Saltar espera»), Recorrido (cada bloque por turno con la salida que tomó y lo que hizo) y Datos (cliente de prueba y variables); los bloques recorridos se iluminan en el lienzo y el que espera late. Prueba lo que está en el lienzo aunque no se haya guardado, con el motor real en un arenero sin estado en el servidor (funciona en Vercel). Seguro: nada sale por WhatsApp, el Pixel nunca va a Meta, el contacto es un cliente de prueba; IA e Integraciones reales opcionales. Retirada la simulación anterior (guardaba sesiones en memoria y llamaba integraciones y Pixel reales). Todas las esperas (pausas, Programador, tiempo máximo) siguen solas a su hora exacta, duren lo que duren, con el reloj del servidor. Tests: `tests/unit/simulationEndToEnd.test.ts` (8, motor real), `apps/web/tests/components/FlowLab.test.tsx` (5), `apps/web/tests/components/LabWaitChip.test.tsx` (4) |

---

## FASE D — Canales y Conversations

**Estado: 🟡 EN PROGRESO**

Objetivo: que un mensaje real de un canal real dispare un flow real y quede visible en un inbox.

| Tarea | Descripción | Estado |
|---|---|---|
| D1 | `domains/connections` — conexiones WhatsApp con dos modos: **QR (WhatsApp Web)** y **API oficial (Meta Cloud API)**. Cada conexión tiene **el flujo que atiende** (`TriggerBinding` conexión → flujo): crear conexión, elegir flujo, escanear QR o poner credenciales de la API, y queda funcionando. Modelo de Leona como referencia funcional, con diseño propio | 🟡 EN PROGRESO — **pantalla y módulo listos** (2026-11-08): `domains/connections`, `011_whatsapp_connections.sql`, permisos `connections.read/write`, `/connections`, pantalla Conexiones (resumen, tarjetas por estado, asistente QR/API oficial, vinculación, renombrar, eliminar). **QR con uazapi** (2026-11-08): instancia por conexión, QR que se renueva solo y la pantalla pasa sola a «conectado», token de cada instancia cifrado (`012_whatsapp_connection_secret.sql`), avisos de conexión verificados en `/webhooks/uazapi`; se activa con `UAZAPI_BASE_URL` + `UAZAPI_ADMIN_TOKEN`. **Disparadores por conexión** (2026-11-09): palabra clave (contiene / exacta / empieza por, sin tildes ni mayúsculas), viene de un anuncio, primer mensaje y cualquier mensaje; gana el más específico (`selectTrigger`, compartido), una palabra por flujo, un genérico de cada tipo, pausables (`013_connection_triggers.sql`). **QR**: cuenta atrás real (primer código ~60 s, luego ~20 s, ~2 min 45 s en total, medido con uazapi) y «Generar otro código» siempre a mano. Faltan: la app de Meta para la API oficial y los mensajes entrantes que usen los disparadores (D4) |
| D2 | `domains/connections` — adaptador Telegram | ⬜ POR HACER |
| D3 | `domains/conversations` — inbox mínimo: lista, hilo, estado, contacto asociado | ✅ HECHO (2026-11-09) — **bandeja estilo WhatsApp de iOS** (claro y oscuro): un chat por cliente y número en Neon (`016_conversations.sql`: `conversations` + `conversation_messages`), cada mensaje del cliente, del bot (con el flujo que lo envió) y del asesor queda guardado con su estado (enviado / no se envió y por qué); lista con no leídos, búsqueda por número, filtros (todos, no leídos, atendidos por asesor) y por número; hilo con separadores por día y mensajes antiguos por páginas; responder como asesor (pausa el bot de ese chat), interruptor del bot y **enviar un flujo a mano** (termina el flujo en curso y arranca el elegido, `StartFlowService`); con el bot pausado los mensajes se guardan pero no se responden (`bot_paused`). Permisos `conversations.read/write`, `/conversations`, ruta web `/conversations`, actualización cada 4 s. **Filtros y etiquetas como Leona** (2026-11-09): estado (todos, no leídos, con bot, con asesor), número, etiquetas del cliente (cualquiera de las elegidas) y fecha del último mensaje (hoy, ayer, 7 y 30 días o rango, en la zona horaria de quien mira); etiquetas en cada chat y «Info. del contacto» para ponerlas o crearlas (las mismas de Contactos y de los flujos, `PUT /conversations/:id/labels`); «Ejecutar flujo» a la vista; lista por páginas de 50 con cursor (`017_conversations_activity_index.sql`); colores medidos en las capturas oficiales de iOS (fondo #F6F1EB / #0A0A0A) con dibujo de fondo propio, colita en la última burbuja de cada tanda y un visto gris de «enviado» |
| D4 | Cierre del ciclo: canal → `ExternalEvent` → `TriggerResolver` → flow-engine → sesión visible en Conversations | 🟡 EN PROGRESO — **mensajes reales de punta a punta** (2026-11-09): aviso `messages` de uazapi verificado con el token de la instancia → `domains/messaging` (`HandleInboundMessageService`: registro sin duplicados `015_inbound_messages.sql`, candado por conversación en PostgreSQL, contacto con su nombre de WhatsApp, flujo en curso o disparador) → motor de producción (flujos guardados, sesiones en `014_flow_sessions.sql`, IA/píxel/integraciones/comprobante reales) → respuestas por uazapi (texto, archivos, botones/listas, reacciones, pausas ≤ 20 s), procesado tras responder (`waitUntil`). Programador, tiempos de espera y pausas largas: con la cola de tareas (C6) |

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
| G2 | Contactos (`domains/contacts`) | 🟢 COMPLETADO (2026-11-08, adelantado por C10) — contactos, catálogo de etiquetas, API y pantalla `/contacts` |
| G3 | Integraciones (`domains/integrations`) | 🟢 COMPLETADO (2026-11-08) — conexiones de IA y píxeles de Meta, pantalla `/integrations` por secciones |
| G4 | Mi perfil | 🟢 COMPLETADO (2026-11-10) — tarjeta de la cuenta abajo en la barra lateral con su menú estándar (Mi perfil, Empresa, Equipo · Pagos y suscripciones · Ayuda «Pronto», tema claro/oscuro/sistema, cerrar sesión, cambiar de empresa). Mi perfil: foto (Vercel Blob, validada por el servidor), nombre visible y WhatsApp personal en `user_profiles` (028), correo de acceso visible (Neon Auth no deja cambiarlo: `CHANGE_EMAIL_DISABLED`) y cambio de contraseña. Ver `docs/architecture/account.md` |
| G5 | Configuración — incluida la pantalla de seguridad que usará `passwordClient.change`, ya implementado en el cliente | 🟡 EN PROGRESO — **Empresa** (2026-11-10): logo, nombre y zona horaria de la cuenta (`tenants`, 028; solo dueños, `tenant.manage`). La zona rige el motor (`SqlTenantResolver`: Programador, horarios, fechas, Laboratorio). La seguridad (contraseña) quedó en Mi perfil → Seguridad. Falta lo que traiga cada módulo (notificaciones, etc.) |
| G6 | Ayuda | ⬜ POR HACER |

---

## FASE H — Producción y Escalabilidad

**Estado: ⬜ POR HACER**

| Tarea | Descripción | Estado |
|---|---|---|
| H1 | Registrar dominio de producción en Neon Auth — bloqueante para autenticar en producción | 🟢 COMPLETADO (2026-11-08) — `https://auream-os.vercel.app` en la rama production |
| H2 | Remitente de correo propio (SMTP verificado) en Neon, sustituyendo el compartido de desarrollo | ⬜ POR HACER |
| H3 | Despliegue en **Vercel + Neon** (decisión 2026-11-08: solo esas dos plataformas). Web estática y API como función de Vercel en el mismo dominio (`api/index.ts`, mismo listener que el servidor local); el build revisa la configuración, migra la rama de producción y construye la web | 🟢 COMPLETADO (2026-11-08) — `https://auream-os.vercel.app` en producción: tablas 001–007 en Neon producción, variables separadas (Production → rama production, Preview → rama test, claves de cifrado distintas), sin credenciales de desarrollo; verificado `/api/health`, rutas protegidas (401) y login contra Neon Auth de producción |
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
| 2026-11-08 | **B9 — Bloque de inicio cerrado** y auditoría de la continuación de la FASE B. Inicio pasa a ser un tipo de sistema `start` (antes un `message` que se habría enviado al cliente), con migración al leer en un decorador del repositorio, reglas `validateStartBlock` con paridad y `StartNodeHandler`. Se retira `NodeEditorModal`. B6 se redefine tras auditar los paneles (3 se retiran, Validación y Publicar se montan, Simulador pasa a C15). Corregida la numeración duplicada de C13 (enrutar por salida pasa a C14). |
| 2026-11-08 | **Decisión de producto: sin publicación.** Los flujos se autoguardan y lo guardado es lo que corre; estado activo/archivado, como en Leona. Se retirarán el botón y el circuito de publicar/rollback (`PublishDraftService`, `RollbackDraftService`, `publishedSnapshots`, `useBuilderPublishing`, `ReleasePanel`). En la FASE C el motor ejecuta el borrador guardado. |
| 2026-11-08 | **Modelo de activación de flujos.** Un flujo corre cuando una conexión de WhatsApp lo tiene asignado (`TriggerBinding` conexión → flujo), como en Leona: se crea la conexión, se elige el flujo y se escanea el QR (WhatsApp Web) o se configura la API oficial. D1 pasa a cubrir los dos modos. |
| 2026-11-08 | **B6 y B7 cerrados.** Revisión del flujo estructurada (`reviewFlow`) y visible en el lienzo con navegación al bloque; retirado todo el circuito de publicación (frontend y backend) y los paneles obsoletos; aviso y estado «Sin conexión» con reintento seguro. |
| 2026-11-08 | **B8 cerrado.** Estado de cada bloque en el lienzo: anillo y marca por gravedad con los motivos, y pestaña «Próximamente» en las herramientas que el motor aún no ejecuta. |
| 2026-11-08 | **B10 cerrado.** Duplicar, archivar/restaurar, «Mover a…» y creación explícita por `POST /automations`; abrir el builder deja de crear (cierra C13). |
| 2026-11-08 | **FASE B COMPLETADA.** B12 (responsive validado en 4 tamaños, Toolbox y editor en celular, encuadre inicial corregido), B13 (teclado en lienzo y Toolbox), B14 (Inicio a tokens, conexión seleccionada resaltada) y B15 (auditoría visual con capturas en ambos temas). Los 8 criterios de cierre se cumplen; se desbloquea la FASE C. |
| 2026-11-08 | **Decisión de producto:** sin marcas de error por bloque en el lienzo (saturaban); los problemas viven solo en la revisión del flujo. Se mantiene «Próximamente». |
| 2026-11-08 | **FASE C iniciada: C1 y C2.** Esquema de automatizaciones en PostgreSQL (documento `jsonb` por flujo), repositorios SQL tras los puertos existentes, selección por `AUTOMATIONS_STORE` (producción solo `sql`) e importación idempotente desde archivos, verificada en la rama test. |
| 2026-11-08 | **C3 y C4 cerrados.** Unit of Work con transacción real en PostgreSQL para crear/duplicar/guardar/borrar; bloqueo optimista atómico con aviso de conflicto en el builder; validación de entrada de la API (tamaño, JSON, forma, identificador). Verificado en Neon y contra la API real. |
| 2026-11-08 | **C5 y C14 cerrados.** Motor asíncrono de punta a punta (bloques, loop, orquestador, sesiones, registro, simulación) y enrutado por salida con decisión explícita del evaluador. Probado con la cadena real de la API: saluda, espera, sale por «respuesta» y usa el dato guardado. |
| 2026-11-08 | **C10 (1/3): Condicional, Menú y Distribuidor se ejecutan.** Contratos de configuración compartidos builder↔motor; reglas en la zona horaria del negocio sin inventar datos; menú con botones nativos y reconocimiento por id, número o texto; reparto por turnos atómico (`005_automation_counters.sql`). Menú y Distribuidor dejan de decir «Próximamente». |
| 2026-11-08 | **C10 (2/3): Contactos y Etiquetas.** Dominio `contacts` (contacto único por canal y teléfono, campos personalizados, catálogo de etiquetas con color) en PostgreSQL (`006_contacts.sql`), API con permisos `contacts.read`/`contacts.write` y pantalla `/contacts`. El bloque Etiquetas se ejecuta (crea en el catálogo las que falten) y el Condicional lee las etiquetas reales; sus editores ofrecen el catálogo de la cuenta. Verificado en Neon y contra la API real. |
| 2026-11-08 | **C10: Integración y variables.** El bloque Integración llama a cualquier servicio (método, URL, cabeceras y cuerpo con variables), sale por Éxito/Error y guarda datos de la respuesta en el contacto. Cliente HTTP propio con protección SSRF, plazos y tamaños; «Probar» en el editor con selección de datos de la respuesta y límite por cuenta. Variables unificadas (`{first_name}`, campos del contacto, valor por defecto `{x|y}`) en Mensaje, Menú, Esperar respuesta e Integración. Verificado contra la API real: flujo completo por las dos salidas, bloqueos SSRF y límite 429. |
| 2026-11-08 | **C9: Extensión IA.** Conexiones de IA por cuenta (OpenAI, Gemini, OpenRouter): la clave se verifica con el proveedor y se guarda cifrada (AES-256-GCM, atada a cuenta y conexión, rotación por versiones; `007_ai_credentials.sql`); nunca vuelve al navegador. Permisos `credentials.read`/`credentials.write`. El bloque usa la conexión (no una clave), responde, recuerda la conversación, clasifica intención con una salida por intención y se prueba desde el editor. Pantalla `/integrations`. Piezas de página comunes en `shared/ui`. Verificado contra los tres proveedores reales (rechazo de claves) y Neon. |
| 2026-11-08 | **Archivos de los mensajes guardados de verdad.** Antes, una foto o video elegido desde el dispositivo vivía solo en la memoria del navegador y se perdía al recargar. Ahora se sube al elegirlo: permiso de un solo uso por cuenta (formatos y tamaños de WhatsApp), subida directa a Vercel Blob, verificación y registro en Neon (`008_media_assets.sql`); el bloque guarda la URL pública y se ve adentro y en el lienzo tras recargar. Almacenes separados para producción y pruebas. |
| 2026-11-08 | **C10: Pixel de Meta.** Píxeles por cuenta con token cifrado y verificado con Meta (`009_pixel_connections.sql`), sección «Píxeles de Meta» en Integraciones. El bloque registra Lead y Compra en la API de Conversiones: valor como se escribe en Latinoamérica, atribución al anuncio de clic a WhatsApp (`LeadSubmitted`), datos del cliente cifrados con SHA-256, sin cortar la conversación si Meta falla; «Probar» exige el código de prueba de Meta. Verificado contra la Graph API real. |
| 2026-11-08 | **C10: Comprobante automático (sin IA).** Lee la imagen o el PDF del pago con OCR propio en el servidor (Tesseract + sharp, modelo de español empaquetado; PDF por su capa de texto), extrae valor, moneda, fecha, referencia y pagador con reglas para comprobantes de Latinoamérica (Bancolombia, Nequi, SPEI, PIX…) y verifica cuenta (completa o enmascarada), titular con variantes, monto exacto o mínimo, antigüedad en la zona del negocio y repetidos (`010_payment_proof_receipts.sql`, registro atómico). Catálogos de países y entidades movidos a `contracts/` (los comparte el motor). «Probar» con una captura real desde el editor, sin gastar el comprobante. |
| 2026-11-08 | **D1 (visual y módulo): Conexiones de WhatsApp.** Dos formas de conectar —código QR mediante un proveedor externo (Vercel no puede mantener una sesión de WhatsApp Web) y API oficial de Meta—. Módulo `domains/connections` con su tabla en Neon (`011_whatsapp_connections.sql`), permisos `connections.read` (todo el equipo) y `connections.write` (dueños y administradores) y la pantalla: resumen de estados, tarjetas con número y bandera, asistente en dos pasos y vinculación que hoy indica sin fingir que el proveedor está por conectar. En la revisión del builder: bloques nuevos en cascada y seleccionados, y el editor anunciado como diálogo. |
| 2026-11-08 | **D1: vincular por QR con uazapi.** Cliente de uazapi (crear instancia, QR, estado, borrar, avisos) según su documentación; el token de cada instancia se guarda cifrado; «Vincular número» muestra el QR, se renueva solo y la pantalla pasa a «¡Número conectado!» al escanear; si el código vence, se genera otro; eliminar borra la sesión en uazapi (si falla, no deja huérfanas). Avisos de desconexión en `POST /webhooks/uazapi`, válidos solo con el token de esa conexión. |
| 2026-11-09 | **D1: disparadores por conexión y QR con tiempo.** Cada número elige qué flujo inicia: palabra clave, anuncio de clic a WhatsApp, primer mensaje o cualquier mensaje; gana el más específico, sin palabras repetidas entre flujos y un genérico de cada tipo; se pausan y se quitan desde la tarjeta, que avisa si el número no inicia ningún flujo. El QR muestra cuánto le queda a cada código y el tiempo total (medido con uazapi real), y «Generar otro código» descarta el actual (desconectar + conectar). |
| 2026-11-09 | **D4: los números responden con sus flujos.** Un mensaje de WhatsApp llega por el aviso de uazapi (verificado con el token de esa conexión), se responde enseguida y se procesa después: sin duplicados, de a uno por conversación, el contacto se crea con su nombre de WhatsApp, continúa el flujo en curso o el disparador elige uno, el motor de producción lo corre con sesiones y flujos guardados en Neon y las respuestas salen por uazapi (texto, imágenes/video/audio/archivos, botones y listas, reacciones, pausas). El Mensaje ya entrega archivos y pausas; «Esperar respuesta» acepta fotos y archivos. Registro de cada mensaje con su resultado. Probado de punta a punta contra Neon y uazapi. |
| 2026-11-09 | **D3: bandeja de Conversaciones.** Pantalla estilo WhatsApp de iOS en modo claro y oscuro (en el celular, una columna). Cada chat y cada mensaje —del cliente, del bot y del asesor— quedan guardados en Neon con su estado; los envíos fallidos se ven con su motivo. El asesor responde desde la bandeja (el bot de ese chat se pausa solo), puede reactivar el bot y enviar cualquier flujo a mano. No leídos, búsqueda, filtros por estado y por número, mensajes antiguos por páginas. Pruebas de servicio, de PostgreSQL y de la pantalla. |
| 2026-11-09 | **D3: filtros, etiquetas y diseño iOS fiel.** La bandeja filtra como Leona: con bot o con asesor, número, etiquetas y fecha del último mensaje (hoy, ayer, 7 o 30 días, o fechas elegidas); cada chat muestra las etiquetas de su cliente y desde «Info. del contacto» se ponen, quitan o crean (un solo catálogo con Contactos y los flujos). «Ejecutar flujo» visible en el chat y en la info. Lista por páginas («Ver más chats»). Colores tomados de las capturas oficiales de WhatsApp para iPhone: fondo claro casi blanco y oscuro casi negro, burbujas iguales, colita en la última burbuja y visto gris de enviado. Pruebas de servicio, PostgreSQL y pantalla. |
| 2026-11-09 | **Eliminar un número conserva sus chats.** Al eliminar una conexión se desconecta en uazapi, pierde su credencial y sus disparadores y desaparece de Conexiones, pero no se borra de la base (`018_connection_soft_delete.sql`): sus chats siguen en la bandeja marcados «número eliminado», se pueden leer y etiquetar, y no se puede responder, ejecutar flujos ni activar el bot desde ellos. El nombre queda libre para un número nuevo. |
| 2026-11-09 | **El Menú puede volver a sí mismo, como en Leona.** Verificado en los flujos reales de Leona: la única conexión de un bloque consigo mismo es «Otra respuesta» del Menú (vuelve a mostrar el menú si el cliente escribe algo que no es una opción). En Auream se permite solo esa (`canConnectToItself`), se dibuja como un lazo por debajo del bloque y el motor reenvía el menú y espera, sin dar vueltas. |
| 2026-11-09 | **Nombres con guion, como Leona.** Variables (`{resposta-lead}`), campos de contacto, «Guardar en» de Esperar respuesta, la variable que lee el Comprobante y las salidas de Extensión IA aceptan guion además de letras, números, punto y guion bajo. Primer flujo traído de Leona: «Reconstruye tu vida venezuela» (38 bloques, mismas posiciones y tiempos; el bloque de IA pasa a Comprobante automático y Venta aprobada se omite porque no existe en Auream). |
| 2026-11-09 | **Comprobante con dos salidas y Conversaciones con la cabecera estándar.** El Comprobante automático sale por «Comprobante válido» o «Comprobante rechazado» (el motivo queda en la variable de error); separar los rechazos por motivo es una opción, y los bloques guardados antes la conservan. Conversaciones usa la misma cabecera de los módulos (título y descripción como Automatizaciones). |
| 2026-11-09 | **C6: la cola de tareas.** Los flujos ya continúan solos: el Programador sigue a su hora (espera, fecha y horario en la zona del negocio), «Tiempo agotado» de Esperar respuesta y Menú se dispara al vencer, y las pausas largas de un Mensaje se retoman justo después sin desordenar nada. Cola genérica en Neon con reservas atómicas, reintentos y limpieza; despertadores vencidos se descartan; con el bot pausado no se mueve nada y el flujo sigue al reactivarlo. Pruebas de motor, cola, mensajería de punta a punta, PostgreSQL y seguridad del endpoint. |
| 2026-11-09 | **Chat en vivo, chulos de WhatsApp, «escribiendo…» y despertadores de la cola.** Cada mensaje del bot aparece en Conversaciones apenas sale hacia WhatsApp y muestra sus chulos reales: uno gris (enviado), dos grises (entregado) y dos azules (leído), con los avisos `messages_update` de uazapi (solo avanzan; `020_conversation_live.sql`). La bandeja pide solo lo nuevo o cambiado (`/conversations/:id/live?since=`), cada 1,5 s con movimiento y 4 s en calma, y nada con la pestaña oculta. Burbujas compactas (texto de 14 px). Durante las pausas de un Mensaje el cliente ve «escribiendo…» o «grabando audio…» (si lo siguiente es un audio), como en Leona. La cola de tareas arma un despertador con Vercel Queues para lo que vence en minutos, horas o días (`api/task-alarm.ts`): el Programador y los tiempos de espera llegan a su hora con el plan Hobby, sin funciones esperando; `CRON_SECRET` configurado en producción y obligatorio en el despliegue. Las sesiones que quedaron esperando con la versión anterior siguen con el próximo mensaje. Pruebas de motor, entrega, uazapi, avisos, cola, PostgreSQL, seguridad y pantalla. Ver docs/architecture/conversations.md y task-queue.md. |
| 2026-11-09 | **Los despertadores ya suenan: intervalos a su hora.** En producción ningún despertador de Vercel Queues llegaba: el proyecto apaga las ayudas de Vercel (`NODEJS_HELPERS=0`, la API lee el cuerpo ella misma) y el consumidor de la librería para `(req, res)` depende de ellas, así que cada entrega fallaba sin llamar a nadie y un Intervalo solo seguía si otra cosa despertaba la cola (uno de 3 min siguió a los 7; uno de 1 min no siguió). El consumidor usa ahora el manejador web de la librería con un adaptador propio (`webHandlerOnNode`) y lo prueba una entrega igual a la de Vercel en un servidor sin ayudas. Además: cada instancia nueva rearma el despertador de la próxima pendiente (recupera los perdidos), el registro avisa `tasks.late` si una tarea corre más de un minuto tarde, y el Intervalo y el tiempo máximo de Esperar respuesta y Menú cuentan desde el último mensaje (después de sus pausas de «escribiendo…» y de lo que tardaron los envíos), no desde que empezó el turno. **Puntualidad:** el despertador suena 15 s antes y la ronda espera la hora exacta; el trabajador toma cada tarea en su hora aunque otros chats sigan en curso (16 a la vez, 20 candados por instancia); medido contra Neon con un turno de 15 s en medio: cada tarea se tomó una ida y vuelta a la base después de su hora. Relojes de Vercel y Neon en hora de internet (NTP). |
| 2026-11-09 | **Notificación funcionando, como en Leona.** El bloque avisa por WhatsApp a un número del equipo (nombre, prefijo y número), desde el mismo número conectado que atiende el chat, en orden con el resto del turno; el aviso no queda en el chat del cliente y uno mal configurado no detiene la venta. El texto admite variables, y se suman `{fecha}` y `{hora}` en la zona del negocio (`{data}` como en Leona; un campo con ese nombre manda). Contrato compartido `contracts/NotificationConfig.ts`; el simulador marca el aviso «🔔 Aviso a…». Las 12 herramientas ya se ejecutan. |
| 2026-11-09 | **Anuncio de clic a WhatsApp, límite de peticiones e historial interno.** El aviso de uazapi trae el anuncio por el que escribió el cliente (`sourceID`, `sourceURL`, `mediaURL`, `thumbnailURL`, `ctwaClid`, también en formato `referral`): queda en su ficha (`021_contact_ad_origin.sql`; el último reemplaza al anterior) y se usa por dentro con los nombres de Leona (`{source_id}`, `{source_url}`, `{media_url}`, `{thumbnail_url}`, `{ctwa_clid}`): la Notificación y el Pixel, que ahora sí atribuye la compra al anuncio. Límite de peticiones compartido en Neon (C11). Historial interno de cada turno (C12). |
| 2026-11-09 | **Centro de Integraciones y webhooks de entrada, como Leona.** Integraciones es un catálogo por categorías con buscador, «Activas» y «Disponibles», y una página por integración (OpenAI, Gemini y OpenRouter por separado, Píxel de Meta, Webhooks); agregar una nueva es una línea en el registro. Webhooks de entrada: dirección secreta (guardada cifrada) para n8n, Make, Hotmart o formularios; «Esperar envío de ejemplo» y mapeo con clic en el árbol de datos; identifica al cliente por su teléfono (completo, con prefijo), guarda nombre, correo y campos, pone y quita etiquetas e inicia un flujo por su número; historial de 30 días con lo que se hizo y por qué; 600 envíos/min por webhook. Sin Kanban. Ver `docs/architecture/integrations.md`. |
| 2026-11-09 | **Agentes de IA por MCP, con permisos por área (Leona no los tiene).** Servidor MCP en `/api/mcp` (JSON-RPC sobre HTTP, sin estado) para Claude Code, Cursor o n8n: credenciales por cuenta con permisos de ver o ver y editar en Flujos, Contactos y etiquetas, Conversaciones y Números de WhatsApp; el token se muestra una vez y se guarda solo su huella; vence o se revoca al instante; cada acción queda registrada; 300 peticiones/min por credencial. 13 herramientas sobre los mismos servicios de la app (buscar, crear, editar y etiquetar contactos; leer flujos; leer chats, responder y enviar flujos; ver números). Pantalla en Integraciones → Agentes de IA con la dirección, cómo conectar cada agente y la matriz de permisos. Sigue: OAuth para Claude web/escritorio y herramientas para editar flujos. |
| 2026-11-09 | **Claude web y escritorio se conectan al MCP con OAuth, como en Leona.** Se pega solo la dirección (`https://auream-os.vercel.app/api/mcp`); Claude abre Auream, el usuario inicia sesión, elige cuenta y permisos por área, y autoriza. OAuth 2.1 completo: descubrimiento (RFC 9728 y 8414), registro dinámico del agente (RFC 7591), PKCE S256 obligatorio, código de un solo uso de 10 minutos, tokens de acceso de 1 hora y de renovación de 30 días que rotan; todo guardado como huella y borrado al revocar la credencial. La credencial aparece en Integraciones como «Autorizada con OAuth». Migración `026_mcp_oauth.sql` (aditiva). Sigue: herramientas para crear y editar flujos. |
| 2026-11-09 | **Los agentes de IA crean y editan flujos por MCP, con las mismas reglas del editor.** Nuevo nivel «Flujos: ver y editar». Herramientas: crear y renombrar flujos; agregar (conectado después de un bloque o insertado en medio), configurar, borrar, conectar y desconectar bloques; tipos de bloque con su guía (campos, salidas, ejemplo) y recursos (conexiones de IA y píxeles). Cada respuesta trae la «Revisión del flujo». Las reglas de los bloques (valores por defecto, salidas, validación, forma canónica, conexiones y revisión) pasaron a `contracts/blocks`, una sola fuente para el editor web y el MCP. Bloqueo optimista con reintento: nunca pisa lo que el usuario guarda en el editor. |
| 2026-11-10 | **Conexiones, chats e integraciones más profesionales, como Leona.** Conexiones: tarjeta compacta con la foto de perfil del número y menú de acciones con iconos según el estado (Ver estado / Vincular / Reconectar, Reiniciar conexión, Desconectar, Disparadores, Renombrar, Eliminar). Desconectar cierra la sesión de WhatsApp pero conserva la conexión, sus disparadores y sus chats (se reconecta con un QR nuevo); Reiniciar retoma la conexión sin desvincular (uazapi `/instance/disconnect`, `/instance/reset`). Chats: filas compactas y foto de perfil de WhatsApp de cada cliente (se renueva sola; si vence, iniciales). Integraciones: logos reales de cada servicio sobre fichas neutras. Migración `027_profile_pictures.sql` (aditiva). |
| 2026-11-10 | **Laboratorio de pruebas en el editor (C15) y conexiones que uazapi desconecta sin avisar.** Laboratorio: probar el flujo del lienzo como cliente en un chat estilo WhatsApp (pausas reales, «escribiendo…», audios e imágenes; las esperas de hasta un minuto siguen solas), con recorrido bloque a bloque, datos del cliente de prueba y variables, bloques iluminados en el lienzo, «Saltar espera», IA e Integraciones reales opcionales, sin enviar nada real. Conexiones: «Ver estado» consulta primero al proveedor y lleva al QR si la sesión murió; desconectar y reiniciar toleran sesiones borradas; revisión automática al abrir Conexiones (1/min por cuenta). |
| 2026-11-10 | **Las esperas siguen solas a su hora, en el laboratorio y en los flujos reales.** Laboratorio: una espera de más de un minuto (p. ej. un Programador de 4 min) se quedaba quieta hasta tocar «Adelantar espera»; ahora toda espera cuenta el tiempo y sigue sola justo a la hora, corrigiendo la diferencia de reloj con el servidor y revisando al volver a la pestaña. Flujos reales: además de los despertadores de Vercel Queues (que sí suenan a su hora; «Queued» en su tablero cuenta los rearmados), dos redes de seguridad: el tráfico de la API revisa cada 10 s por instancia si algo vence en segundos y despierta al trabajador (a su hora mientras alguien usa la app aunque se pierda un despertador), y la revisión periódica pasa de una vez al día (Vercel Cron) a cada 15 min con Vercel Schedules (`tasks-sweep`). Tests: `taskWakeOnTraffic.test.ts` (4), `LabWaitChip.test.tsx` (4). |
| 2026-11-10 | **Cuenta estándar: tarjeta y menú de la cuenta, Mi perfil y Empresa.** Abajo en la barra lateral, la tarjeta con tu foto, tu nombre y la empresa; su menú tiene Mi perfil, Empresa, Equipo, Pagos y suscripciones y Ayuda (estos tres «Pronto», con página «Próximamente»), el tema claro/oscuro/sistema y cerrar sesión, con teclado. La barra queda con el trabajo del día. Mi perfil: foto, nombre y WhatsApp personal guardados en Neon (`user_profiles`), correo de acceso visible y cambio de contraseña. Empresa: logo, nombre y zona horaria (solo dueños); el motor ya usa la zona de cada empresa (`SqlTenantResolver`). Imágenes con las garantías de los medios (`ImageUploads`). Tests: `accountProfiles` (12), `sqlTenantResolver` (3), `routeAccount` (10), `accountPersistence` (3, PostgreSQL real), `AccountMenu` (5), `AccountPages` (5), `accountHelpers` (3). |
| 2026-11-10 | **Menú de la cuenta al ancho de la barra y Configuración.** El menú se abre con el mismo ancho de la tarjeta (no se sale de la barra): etiquetas largas en dos renglones y tema con el icono sobre el nombre. Vuelve «Configuración» al menú (`/settings`, pestañas Empresa y Apariencia con vista previa del tema); la tarjeta de la empresa en el menú abre sus datos. Tests: `AccountMenu` (5), `AccountPages` (6). |
