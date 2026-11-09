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

## Agentes de IA (MCP)

`contracts/McpContracts.ts` · `domains/mcp` · `apps/api/mcp` · `apps/api/routes/routeMcp.ts` · `apps/api/routes/routeMcpCredentialsRequest.ts` · `025_mcp_credentials.sql`

Un agente (Claude Code, Cursor, n8n…) se conecta a `POST /api/mcp` con `Authorization: Bearer <token>` y usa las herramientas que su credencial permite, dentro de SU cuenta.

| Pieza | Responsabilidad | No sabe de |
|---|---|---|
| `domains/mcp` | Credencial: permisos por área (ver / ver y editar) traducidos a los permisos internos, huella del token, vencimiento; crear (el token se entrega una vez), listar, revocar, autenticar | HTTP, MCP |
| `apps/api/mcp/McpProtocol.ts` | El protocolo (JSON-RPC 2.0, sin estado): `initialize` (negocia la versión), `ping`, `tools/list` (solo lo permitido), `tools/call` (vuelve a comprobar el permiso y valida los argumentos) | qué hace cada herramienta |
| `apps/api/mcp/tools/*` | Las herramientas, como adaptadores sobre los MISMOS servicios de la app (flujos, contactos y etiquetas, conversaciones, números) | el protocolo |
| `routeMcp` | Transporte HTTP («Streamable», sin flujo de eventos): token, límite, JSON-RPC simple o en lote | — |

Reglas:

- **Permisos por área** (Leona no los tiene): Flujos (ver), Contactos y etiquetas (ver / ver y editar), Conversaciones (ver / ver y responder o enviar flujos), Números de WhatsApp (ver). `tools/list` solo muestra lo permitido y `tools/call` lo vuelve a comprobar.
- **El token** (`aur_mcp_` + 32 bytes aleatorios) se muestra una vez; se guarda su huella SHA-256 (única) y una pista. Vence a los 30, 90 o 365 días, o nunca; revocarlo corta el acceso al instante.
- **Errores:** uno de negocio («ese contacto no existe») vuelve como resultado con `isError` para que el agente se corrija; uno interno, sin detalles.
- **Registro:** cada acción (`mcp.tool_call`: credencial, herramienta, resultado, duración; sin los datos). Límite: 300 peticiones por minuto por credencial.
- **Administrarlas** exige `credentials.write` (dueños y administradores).
- **Responder como asesor** pausa el bot del chat, como en la bandeja; las herramientas que escriben al cliente piden confirmarlo antes.

Siguiente: **OAuth** para Claude en la web y en la app de escritorio (pegas la dirección, inicias sesión en Auream y autorizas los permisos), y herramientas para **crear y editar flujos**.
