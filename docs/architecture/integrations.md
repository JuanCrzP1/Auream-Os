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
| `components/`, `webhooks/`, `mcp/` | Los paneles de cada módulo |
| `shared/ui/integration-kit/` | **El kit compartido** (también lo usa Meta Ads): logos de marca (`IntegrationMark`, `MetaMark`), tarjeta de conexión, sección con sus estados, diálogo de renombrar o cambiar la clave y campo secreto. Cada pieza con su CSS |

Agregar una integración = su definición y su panel en el registro + su fuente. La página no cambia.

**El Píxel de Meta vive en Meta Ads** (`/meta-ads?tab=pixel`, `features/ads/pixel/`), junto al rendimiento de las campañas y las cuentas. En el centro queda la tarjeta «Meta Ads» (`href` en su definición) que lleva allá, y `/integrations/meta-pixel` redirige. La API (`/pixel-connections`) y el bloque «Pixel» no cambian.

**Varios píxeles por cuenta** (una marca o tienda por píxel): cada uno con nombre propio (índice único por cuenta, sin importar mayúsculas) y **una sola vez**. Conectar de nuevo un ID que ya está da `409` («ya está conectado como…») antes de llamar a Meta, porque dos conexiones del mismo píxel duplicarían sus conversiones; para otro token está «Cambiar token». Cada bloque «Pixel» elige un píxel; para avisar a dos, dos bloques.

**El bloque «Pixel» solo elige** (como en Leona): los píxeles se conectan y administran únicamente en Meta Ads, el único lugar donde entra un token. Sin píxeles, el bloque ofrece «Conectar un píxel en Meta Ads» (otra pestaña) y, al volver al editor, la lista se pide de nuevo sola (`visibilitychange` en `BuilderResourcesProvider`). Lo propio del flujo sí va en el bloque: el evento, el valor, la moneda y la página de Facebook del anuncio (opcional), porque puede cambiar de un flujo a otro.

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

### Logos

`components/IntegrationGlyph.tsx`: el logo de cada servicio (OpenAI, Gemini, OpenRouter, Meta y MCP de Simple Icons, CC0, solo para identificar el servicio; el de webhook es propio) sobre una ficha neutra (`provider-mark`). Una integración nueva agrega su `IntegrationMarkKind` y su trazo.

## Agentes de IA (MCP)

`contracts/McpContracts.ts` · `contracts/McpOAuthContracts.ts` · `domains/mcp` · `apps/api/mcp` · `apps/api/routes/routeMcp.ts` · `apps/api/routes/routeMcpCredentialsRequest.ts` · `apps/api/routes/routeOAuthPublic.ts` · `apps/api/routes/routeOAuthConsentRequest.ts` · `025_mcp_credentials.sql` · `026_mcp_oauth.sql`

Un agente se conecta a `POST /api/mcp` con `Authorization: Bearer <token>` y usa las herramientas que su credencial permite, dentro de SU cuenta. Hay dos maneras de obtener ese token:

- **Credencial con token fijo** (`kind: token`): Claude Code, Cursor, n8n… Se crea a mano en Integraciones → Agentes de IA y se pega el token.
- **OAuth** (`kind: oauth`): Claude en la web y en la app de escritorio. Se pega SOLO la dirección; Claude abre Auream, el usuario inicia sesión, elige la cuenta y los permisos, y autoriza. La credencial nace al autorizar.

| Pieza | Responsabilidad | No sabe de |
|---|---|---|
| `domains/mcp` | Credencial: permisos por área (ver / ver y editar) traducidos a los permisos internos, huella del token, vencimiento; crear (el token se entrega una vez), listar, revocar, autenticar (token fijo o de acceso OAuth). OAuth (`OAuth.ts`, `McpOAuthServices`): registro del agente, solicitud de autorización, PKCE, códigos de un solo uso y tokens que rotan | HTTP, MCP |
| `apps/api/mcp/oauthMetadata.ts` | Descubrimiento: metadatos del recurso (RFC 9728) y del servidor de autorización (RFC 8414) con las direcciones públicas | — |
| `routeOAuthPublic` / `routeOAuthConsentRequest` | Sin sesión (lo usa el agente): `/.well-known/oauth-*`, `POST /oauth/register`, `POST /oauth/token`. Con sesión y `credentials.write` (la pantalla `/oauth/authorize` de la web): qué agente pide acceso y la decisión | las reglas de OAuth |
| `apps/api/mcp/McpProtocol.ts` | El protocolo (JSON-RPC 2.0, sin estado): `initialize` (negocia la versión), `ping`, `tools/list` (solo lo permitido), `tools/call` (vuelve a comprobar el permiso y valida los argumentos) | qué hace cada herramienta |
| `apps/api/mcp/tools/*` | Las herramientas, como adaptadores sobre los MISMOS servicios de la app (flujos, contactos y etiquetas, conversaciones, números y disparadores, ventas y productos, CRM, Dashboard). Áreas, permisos y catálogo completo: [mcp.md](mcp.md) | el protocolo |
| `routeMcp` | Transporte HTTP («Streamable», sin flujo de eventos): token, límite, JSON-RPC simple o en lote | — |

Reglas:

- **Permisos por área** (Leona no los tiene): Flujos (ver / ver y editar), Contactos y etiquetas (ver / ver y editar), Conversaciones (ver / ver y responder o enviar flujos), Números de WhatsApp (ver). `tools/list` solo muestra lo permitido y `tools/call` lo vuelve a comprobar.
- **El token** (`aur_mcp_` + 32 bytes aleatorios) se muestra una vez; se guarda su huella SHA-256 (única) y una pista. Vence a los 30, 90 o 365 días, o nunca; revocarlo corta el acceso al instante.
- **Errores:** uno de negocio («ese contacto no existe») vuelve como resultado con `isError` para que el agente se corrija; uno interno, sin detalles.
- **Registro:** cada acción (`mcp.tool_call`: credencial, herramienta, resultado, duración; sin los datos). Límite: 300 peticiones por minuto por credencial.
- **Administrarlas** exige `credentials.write` (dueños y administradores).
- **Responder como asesor** pausa el bot del chat, como en la bandeja; las herramientas que escriben al cliente piden confirmarlo antes.

### OAuth (Claude web y escritorio)

1. Claude llama a `/api/mcp` sin token → 401 con `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource/api/mcp"`.
2. Lee los metadatos: el servidor de autorización es el origen de la web (`PUBLIC_APP_URL`, o el dominio de producción). `vercel.json` reescribe `/.well-known/oauth-*` a la función de la API.
3. Se registra solo (`POST /api/oauth/register`, RFC 7591): cliente público, sin secreto; direcciones de regreso https (o http en el propio equipo). Límite: 30 registros por hora por IP.
4. Abre `/oauth/authorize?…` en la web (`OAuthConsentPage`): si no hay sesión pasa por el inicio de sesión y vuelve con la misma consulta. La página muestra el agente, la cuenta, a dónde vuelve y la matriz de permisos (la misma del diálogo de credenciales).
5. Autorizar crea la credencial `oauth` con esos permisos (si el mismo agente ya estaba autorizado en la cuenta, la reemplaza) y un código de 10 minutos; cancelar vuelve con `access_denied`. Siempre se vuelve a una dirección registrada por el agente, con su `state`.
6. Claude cambia el código en `POST /api/oauth/token` con PKCE S256 (obligatorio): token de acceso `aur_at_` de 1 hora y de renovación `aur_rt_` de 30 días, que ROTA en cada uso (el viejo deja de servir). Límite: 60 por minuto por IP.

Todo se guarda como huella SHA-256; códigos y tokens se TOMAN con `delete … returning` (un solo uso aunque lleguen dos peticiones a la vez) y se borran con su credencial: revocarla en Integraciones corta el acceso al instante. Los errores tienen el formato de OAuth (`error`, `error_description`) y van sin caché.

### Editar flujos (permiso «Flujos: ver y editar»)

`domains/automations/editing` · `apps/api/mcp/tools/flowTools.ts` · `apps/api/mcp/tools/flowEditTools.ts` · `apps/api/mcp/blocks/blockGuides.ts`

| Pieza | Responsabilidad |
|---|---|
| `editing/domain/FlowDraftEditor.ts` | Operaciones PURAS sobre el borrador, como en el lienzo: agregar (y conectar después de un bloque; si esa salida ya llevaba a otro, el nuevo se inserta en medio), configurar, borrar, conectar y desconectar. Con las reglas de `contracts/blocks` |
| `editing/domain/prepareBlockConfig.ts` | La configuración que manda el agente: se fusiona con la actual, cada elemento de lista sin `id` recibe uno (las opciones de un Menú son sus salidas) y se lleva a la forma canónica; lo desconocido se informa en `ignoredFields` |
| `editing/domain/blockPlacement.ts` | Dónde va un bloque nuevo en el lienzo (a la derecha del anterior, sin tapar otro) |
| `editing/application/FlowEditingService.ts` | Lee y guarda con los casos de uso del builder (`GetBuilderWorkspaceService`, `SaveDraftService`, bloqueo optimista); si alguien guardó a la vez, relee y reaplica una vez; devuelve la revisión del flujo |
| `mcp/blocks/blockGuides.ts` | Documentación para el agente de cada bloque (campos, salidas, ejemplo). Solo documenta: las reglas son las de `contracts/blocks` |

Herramientas: `list_flows`, `get_flow` (bloques, salidas y a dónde lleva cada una, y la revisión), `list_block_types`, `get_block_type`, `list_flow_resources` (conexiones de IA y píxeles, sin claves) con «ver»; `create_flow`, `rename_flow`, `add_block`, `update_block`, `delete_block`, `connect_blocks`, `disconnect_blocks` con «ver y editar».

Los flujos no se publican: cada cambio se guarda y queda activo al instante; por eso cada operación se valida entera antes de guardar (un error no guarda nada) y su respuesta trae la revisión del flujo, la misma que ve el usuario en el editor.

## App de Meta y borrado de datos

- **La app de Auream en Meta:** tipo Negocio, id `1497068415680505`, portafolio «Auream», caso de uso «Medir datos de rendimiento de los anuncios con la API de marketing». Tiene una configuración de inicio de sesión para empresas, «Conectar Meta Ads», con estas características:
  - token de usuario del sistema que no vence;
  - el cliente debe elegir al menos una cuenta publicitaria;
  - permiso ANALYZE sobre esas cuentas;
  - un solo permiso de la app: `ads_read`.

  El enlace lleva `config_id` y nunca `scope` (`MetaMarketingClient.authorizeUrl`).
- **Interruptor del botón:** `META_LOGIN_CONFIG_ID`. Sin esa variable no hay botón, aunque `META_APP_ID` y `META_APP_SECRET` estén en el servidor. Así la app puede ir a producción antes de que Meta apruebe el acceso avanzado sin mostrar a los clientes un botón que les fallaría.
- **Avisos de Meta** (`routeMetaDataDeletion`, `MetaDataDeletionService`, sin sesión):
  - `POST /meta/deauthorize`: alguien quitó Auream de su Facebook. Se borra la conexión de Meta Ads hecha con su permiso.
  - `POST /meta/data-deletion`: pidió borrar sus datos. Se borra lo mismo, queda constancia en `meta_data_deletions` (migración 047) y responde `{ url, confirmation_code }`.
  - `GET /meta/data-deletion/:code`: el estado, sin datos personales. Lo muestra la página pública `/eliminar-datos?codigo=`.

  Todos verifican el `signed_request` con HMAC-SHA256 y el secreto de la app (`MetaSignedRequest`). Uno falso no borra nada. Solo se guarda una huella SHA-256 del id de la persona.
- **Páginas legales públicas** (`features/legal`, direcciones en `shared/legal/LegalLinks`): `/privacidad`, `/terminos` y `/eliminar-datos`. Los textos están en Markdown (`features/legal/content`) y los datos del responsable en `legalOwner.ts`, el único lugar donde viven; deben coincidir con el certificado de Cámara de Comercio. Las direcciones van en la configuración de la app de Meta: no cambiarlas.

