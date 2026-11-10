# Mapa de módulos

Cada opción de la barra lateral es un **módulo** con la misma separación en todas partes. Esta página dice dónde vive cada pieza para que, al diseñar una opción, nadie tenga que adivinar.

Decisión de producto del 2026-11-10: tomar lo mejor de **Leona** (el bot, los chats, las difusiones), **FunnelChat** (el CRM, los grupos y comunidades, los agentes de IA) y **Vyper** (las ventas por anuncio y el ROAS con Meta), en una sola lista y sin opciones de relleno.

## Las 11 opciones

| Opción | Ruta web | Módulo web (`apps/web/src/features/`) | API | Dominio (`domains/`) | Proveedor (`infrastructure/`) | Estado |
|---|---|---|---|---|---|---|
| Dashboard | `/dashboard` | `dashboard/` | `/dashboard` | `analytics` | — | Por construir |
| Conversaciones | `/conversations` | `conversations/` | `/conversations` | `conversations` · `messaging` | `whatsapp` | ✅ Funciona |
| CRM | `/crm` | `crm/` (`contacts/` · `pipeline/` · `follow-ups/`) | `/contacts` · `/labels` · `/crm/*` | `contacts` · `crm` | — | Contactos ✅; etapas y seguimientos por construir |
| Automatizaciones | `/automations` | `automations/` | `/automations` · `/api/builder/*` | `automations` | — | ✅ Funciona |
| Agentes de IA | `/ai-agents` | `ai-agents/` | — | `ai-agents` + motor `ai-sales-engine` | `ai` | FASE E |
| Difusiones | `/broadcasts` | `broadcasts/` | `/broadcasts` | `broadcasts` | `scheduling` · `whatsapp` | Por construir |
| Grupos y comunidades | `/groups` | `groups/` | `/groups` | `groups` | `whatsapp` | Por construir |
| Meta Ads | `/meta-ads` | `ads/` (`pixel/`) | `/pixel-connections` · `/ads/*` | `integrations` (píxel) · `ads` | `meta` | Píxel ✅ (sección Píxel); rendimiento de campañas y cuentas por construir |
| Ventas | `/sales` | `sales/` (`orders/` · `products/`) | `/sales` · `/products` | `sales` · `products` | — | Por construir |
| Conexiones | `/connections` | `connections/` | `/connections` | `connections` | `whatsapp` | ✅ Funciona |
| Integraciones | `/integrations` | `integrations/` | `/ai-credentials` · `/inbound-webhooks` · `/mcp-credentials` | `integrations` · `webhooks` · `mcp` | `ai` | ✅ Funciona (la tarjeta de Meta lleva a Meta Ads) |

Lo administrativo (Mi perfil, Configuración, Equipo, Pagos y suscripciones, Ayuda) vive en el menú de la cuenta: ver [`account.md`](account.md). Equipo (invitar con enlace, roles y permisos) es una pestaña de Configuración: ver [`team.md`](team.md).

## Cómo se relacionan

```
Anuncio de Meta ──clic──> Conversaciones ──flujo──> Comprobante aprobado ──> Ventas
      │                        │                                              │
   Meta Ads (gasto)         CRM (etapa, valor,                         Productos (qué,
      │                     seguimientos)                               a qué precio)
      └───────────────> Dashboard (ventas, embudo, ROAS) <───────────────────┘
```

- **El chat ya trae su anuncio** (el aviso de uazapi incluye el `sourceID` del anuncio de clic a WhatsApp). Por eso Auream atribuye cada venta a su anuncio sin webhooks entre plataformas, que es lo que Vyper tiene que pedirle a Leona.
- **Meta Ads se conecta con «Conectar con Meta»** (inicio de sesión de Meta, como en Leona), no por webhook: Meta no envía el gasto, hay que pedírselo con su API. Para cuentas de otros negocios la app pasa la revisión de Meta.
- **La venta se registra sola** cuando el bloque Comprobante aprueba el pago: no hace falta un bloque «Venta aprobada» (el catálogo sigue con sus 12 herramientas).
- Los flujos mueven a cada cliente de **etapa del CRM** con el bloque Etiquetas.

## Reglas para cada módulo nuevo

1. **Dos orillas separadas.** La web (`features/<módulo>`) habla con la API solo por HTTP; el negocio vive en `domains/<dominio>`. Los tipos que cruzan van en `contracts/`.
2. **Un dominio no importa otro** ([`dependency-rules.md`](dependency-rules.md)): si Ventas necesita Productos, declara un puerto. Por eso Productos es un dominio aparte: lo usan Ventas, los flujos, los Agentes de IA y Meta Ads.
3. **Proveedor detrás de un puerto.** Meta, uazapi o la API oficial son adaptadores en `infrastructure/`; el dominio no sabe cuál está debajo. `ads` no se llama `meta` para que TikTok o Google sean otro adaptador, no otro módulo.
4. **Cada dominio nuevo nace con su ficha** (`domains/<dominio>/README.md`: qué le pertenece, qué no, de qué depende y qué capas tendrá) y cada módulo web con la suya (`features/<módulo>/README.md`). Las carpetas de código (`domain/`, `application/`, `components/`…) se crean cuando tienen contenido real, no vacías.
5. **Lo que usan dos módulos sube a `shared/`**: el kit de conexiones (`shared/ui/integration-kit/`: logos, tarjeta, sección, avisos de carga y error, diálogos, campo secreto) lo usan Integraciones y Meta Ads.
6. **Cada página vive en su módulo** (`features/<módulo>/pages/`). Mientras se construye, cuenta lo que traerá (`PagePlaceholder`); las rutas están en `apps/web/src/app/router/moduleRoutes.tsx`.
