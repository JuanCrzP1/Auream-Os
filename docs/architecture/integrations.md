# Integraciones: el centro, los webhooks de entrada y lo que viene (MCP)

`apps/web/src/features/integrations` · `contracts/WebhookContracts.ts` · `domains/webhooks` · `infrastructure/persistence/sql/SqlWebhookRepository.ts` · `024_inbound_webhooks.sql` · `apps/api/routes/routeWebhooksRequest.ts` · `apps/api/routes/routeInboundWebhook.ts`

## El centro de Integraciones (web)

Un catálogo por categorías (Inteligencia artificial, Seguimiento, Automatización, Agentes de IA), con buscador, «Activas» (con algo conectado) y «Disponibles», como el de Leona.

| Pieza | Responsabilidad |
|---|---|
| `catalog/integrationCatalog.ts` | El modelo, puro: definición, entrada (definición + conteo), filtro por categoría y búsqueda sin tildes, activas y disponibles, estado combinado (el centro solo muestra error si fallan **todas** las fuentes) |
| `catalog/integrationRegistry.tsx` | **El único lugar que se toca para agregar una integración**: su definición, su `Panel` (página `/integrations/<id>`) y, si hace falta, su `ItemPage` (`/integrations/<id>/<elemento>`, p. ej. el editor de un webhook) |
| `catalog/sources.ts` | Una fuente por módulo: cuántas hay conectadas de cada integración, con los mismos datos que sus paneles |
| `hub/` | La pantalla del catálogo y sus tarjetas |
| `pages/` | La página del centro, la de cada integración y la de un elemento (no conocen ninguna integración en concreto) |
| `components/`, `webhooks/` | Los paneles de cada módulo |

Agregar una integración = su definición y su panel en el registro + su fuente. La página no cambia.

## Webhooks de entrada

Una dirección secreta (`POST /api/hooks/in/<id>/<secreto>`, JSON o formulario) que recibe datos de cualquier sistema y, con su **mapeo**, actúa sobre el contacto.

```
sistema externo ──POST──> routeInboundWebhook ── 202 enseguida
                              │ autentica (id + secreto, comparación en tiempo constante)
                              ▼ en segundo plano
                     ReceiveWebhookService.process
                       ├─ guarda el envío como ejemplo (para mapear con clic)
                       ├─ teléfono (normalizado, completo con su prefijo)
                       ├─ contacto: lo crea o lo encuentra; nombre, correo, campos
                       ├─ etiquetas: poner y quitar
                       ├─ flujo: por el número del webhook (abre el chat y lo envía
                       │  como el envío a mano: reemplaza el que estuviera en curso)
                       └─ historial: qué se hizo, qué se omitió y por qué (30 días)
```

| Pieza | Responsabilidad | No sabe de |
|---|---|---|
| `domains/webhooks/domain` | Entidad, validación del mapeo, leer un dato por su ruta, normalizar el teléfono | HTTP, SQL, otros dominios |
| `WebhookAdminServices` | Listar (con lo recibido en el mes), crear, ver (con la dirección), editar, borrar, historial | cómo se recibe |
| `ReceiveWebhookService` | Autenticar y procesar un envío | Contactos, Conexiones y la mensajería (puertos) |
| `composeWebhookServices` | Une los puertos con Contactos, Conexiones y `StartFlowForContactService` | — |

Reglas:

- **El secreto se guarda cifrado** (`CREDENTIALS_ENCRYPTION_KEY`, con el contexto del webhook) y la dirección se arma al mostrarla. Sin la clave maestra no hay webhooks (503).
- **Administrarlos exige `credentials.write`** (dueños y administradores): llevan un secreto y pueden iniciar flujos.
- **Mejor que Leona:** los datos y las etiquetas no necesitan número (solo iniciar el flujo); el teléfono se compara completo, con su prefijo, no por los últimos 8 dígitos; un local con «0» de larga distancia (0412…) se corrige.
- **Una dirección equivocada** (id o secreto) recibe 404, sin decir cuál falló.
- **Límite:** 600 envíos por minuto por webhook (la cuenta compartida en Neon). Envíos de hasta 256 KB.
- **Sin Kanban:** Auream no lo tiene.

## Lo que viene: MCP

Credenciales para agentes de IA (Claude, n8n, Cursor) con **permisos por área** (Leona no los tiene), token fijo y OAuth, y un servidor MCP en `/api/mcp`. Entra al catálogo como una integración más de «Agentes de IA».
