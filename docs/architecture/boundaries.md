# Fronteras de dominio

Qué posee cada dominio y —más importante— qué no debe absorber. Las exclusiones son la parte operativa de este documento: son las que evitan que un dominio crezca hasta tragarse a otro.

Estado: `IMPLEMENTADO` tiene código funcional y conectado · `PREPARADO` tiene código sin consumidor · `NO IMPLEMENTADO` es solo frontera.

---

## automations · `IMPLEMENTADO`

El producto: administrar y construir automatizaciones.

Sub-módulos: `catalog` (flows, carpetas, metadata), `builder` (draft, publish, rollback, simulate), `validation` (reglas de grafo previas a publicar), `versioning` (snapshots inmutables y rollback).

**No contiene:** ejecución de flows —eso es `flow-engine`— · handlers de nodo · evaluación de edges · persistencia concreta · adaptadores HTTP · estado de sesión · lógica de inbox humano · lógica comercial de IA.

**Frontera con `flow-engine`:** Automations produce versiones publicadas; el motor las ejecuta. Depende de él solo por interfaces (`FlowRegistry`, `FlowExecutor`), siempre con `import type`. Detalle en [`automations.md`](automations.md).

---

## flow-engine · `IMPLEMENTADO` — no es un dominio

Vive en `flow-engine/`, en la raíz, **no bajo `domains/`**: es un motor técnico, no un bounded context de negocio. Se documenta aquí porque su frontera con `automations` y `sessions` debe leerse junto a las demás.

Motor de ejecución: recibe un mensaje entrante y avanza la ejecución de una versión publicada.

Piezas: `execution` (orquestador, loop, eventos), `edges` (evaluación de condiciones), `nodes` (runtime y un handler por tipo), `registry` (versión publicada activa), `ports` (lo que necesita y lo que ofrece).

**No contiene:** administración de automatizaciones · construcción de flows · validación estructural · versionado · estado de sesión (lo consume por puerto) · infraestructura · frontend · nada del AI Sales Engine.

**Frontera con `sessions`:** el motor decide *qué nodo sigue*; `sessions` guarda *dónde está* cada conversación. Ese estado se consume por `SessionStore` y `ContextWriter`, nunca importando `sessions` directamente.

Documento propio: [`flow-engine.md`](flow-engine.md).

---

## sessions · `IMPLEMENTADO`

Estado de ejecución del runtime: ciclo de vida de la sesión, contexto acumulado y el registro de conversación que el runtime necesita para enrutar un mensaje entrante.

**No contiene:** inbox operacional · etiquetas · asignación a humanos · notas internas · historial de mensajes persistido · lógica de flows.

**Advertencia.** `sessions` no es Conversaciones. El runtime identifica el hilo por `InboundEnvelope.conversationKey` —una clave, no una entidad—; el hilo que ve un operador pertenece a `conversations`. Fusionar ambos es el error de diseño que este dominio existe para prevenir.

Existió una entidad `Conversation` en `contracts/RuntimeContracts.ts` y un `ConversationService` dentro de `sessions`. Se eliminaron: el servicio no tenía lectores —el orquestador descartaba su resultado— y la entidad es vocabulario de inbox, no de runtime. Cuando exista `conversations`, la entidad nacerá allí.

---

## conversations · `NO IMPLEMENTADO`

Inbox **visual** de la plataforma: lista de chats, chat abierto, mensajes, historial, estado, contacto asociado, asignación humana, notas internas, media.

**No contiene:** estado de ejecución del runtime (`sessions`) · construcción de flows (`automations`) · ejecución de flows (`flow-engine`) · decisión de cuándo se dispara un flow (eso es un trigger) · lógica comercial del AI Sales Engine.

Conversations **no controla flows**: ni los construye, ni los ejecuta, ni decide su disparo.

---

## contacts · `NO IMPLEMENTADO`

Modelo y gestión de contactos por tenant: identidad del contacto, atributos, variables.

**No contiene:** conversaciones ni mensajes · lógica de canal.

---

## connections · `NO IMPLEMENTADO`

Responsabilidad exclusiva: gestionar conexiones externas de WhatsApp.

```
Connections
└── WhatsApp
    ├── QR / WhatsApp Web
    └── Meta Cloud API
```

Ambos serán **adaptadores bajo una interfaz común**: el resto del sistema no debe saber cómo se conectó el WhatsApp. Connections aísla autenticación de conexión, estado, conexión/desconexión, recepción, envío, sesiones y reconexión, y traduce cada mensaje entrante a un `ExternalEvent` (`contracts/TriggerContracts.ts`).

No se implementa Telegram.

**No contiene:** proveedores que no son canal (`integrations`) · lógica de conversación · reglas de facturación por conexión (`billing` decide el precio; `connections` reporta el uso).

---

## integrations · `NO IMPLEMENTADO`

Proveedores externos que no son canal de mensajería: CRMs, calendarios, plataformas de anuncios, webhooks salientes.

**No contiene:** canales de mensajería (`connections`) · credenciales de identidad de la plataforma (`platform/identity`).

---

## billing · `PREPARADO`

Planes, suscripciones, límites, capacidades y aplicación de esos límites.

Hoy existen los contratos y las definiciones de plan; ningún endpoint los invoca todavía.

**No contiene:** medición de consumo (`platform/usage` mide, `billing` decide) · lógica comercial del AI Sales Engine · pasarelas de pago concretas (eso es `infrastructure/providers`).

---

## analytics · `PREPARADO`

Eventos operativos y métricas de negocio. El runtime los emite a través del puerto `AnalyticsSink`.

**No contiene:** logging técnico ni trazas (`platform/observability`) · escritura sobre otros dominios.

**Frontera con `observability`:** `analytics` responde preguntas de negocio; `observability` responde qué hizo el sistema. Un pico de errores es observabilidad; una caída de conversiones es analytics.

---

## team · `IMPLEMENTADO`

Quién pertenece a qué tenant y con qué rol: `Membership` y el alta inicial (`OnboardingPort`, transaccional e idempotente). Invitaciones y gestión de miembros más allá del alta inicial siguen sin construir.

**No contiene:** definición de roles, scopes o políticas (`platform/authorization`) · autenticación (`platform/identity`) · el `Tenant` mismo (`platform/tenancy`).

---

## ai-agents · `NO IMPLEMENTADO`

Administración de agentes desde la plataforma: activación por tenant, configuración, capacidades, canales asociados, estado.

**No contiene:** lógica conversacional o comercial —pertenece a `ai-sales-engine/`— · un segundo motor de IA · copias de archivos del motor.

Detalle en [`ai-agents.md`](ai-agents.md).

---

## Nota sobre el nodo `ai`

`flow-engine/nodes/ai/` es un tipo de nodo del grafo de automatizaciones, no un agente. Es un concepto distinto del dominio `ai-agents` y del AI Sales Engine, y no debe fusionarse con ellos.
