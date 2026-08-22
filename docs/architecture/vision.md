# Arquitectura Completa — Plataforma SaaS Conversacional Enterprise

> **Este documento es la VISIÓN de producto, no el estado actual.**
>
> Describe hacia dónde va la plataforma. Casi todo lo que aparece aquí está
> `NO IMPLEMENTADO`. Para el estado real consulta el [`README.md`](../../README.md)
> de la raíz y los documentos por área de [`docs/architecture/`](.).
>
> **Correcciones ya decididas frente a lo que se lee más abajo:**
>
> - **Handoff:** no es un nodo del Flow Engine. Pertenece **exclusivamente** al
>   AI Sales Engine. Donde este documento lo liste entre los tipos de nodo,
>   prevalece [`ai-sales-engine.md`](ai-sales-engine.md).
> - **Versioning:** no es un sub-módulo de `automations`. Vive en
>   `automations/builder`.
> - **Usage:** no es una capacidad de `platform/`. Pertenece a `domains/billing`.

# Visión General

La plataforma será un sistema SaaS conversacional multi-tenant inspirado conceptualmente en plataformas como Leona, pero diseñado desde cero con arquitectura moderna, modular, escalable y enterprise-grade.

El objetivo NO es construir solamente un constructor de bots.

El objetivo real es construir:

* Runtime conversacional distribuido
* Motor de automatizaciones visuales
* Gestión de conversaciones humanas
* Integraciones empresariales
* Gestión multi-tenant
* Billing por conexiones
* Runtime de sesiones
* Orquestación de eventos
* Sistema extensible de nodos
* Sistema operacional de WhatsApp
* Plataforma modular preparada para crecimiento

La IA NO es el núcleo del sistema.
La IA será una capacidad opcional y modular.

---

# Principios Arquitectónicos

## 1. Multi-tenant real

Todo el sistema debe estar aislado por tenant.

Nunca:

* tenantId desde query string
* acceso cruzado
* datos compartidos accidentalmente
* caches globales inseguros

Cada:

* flow
* sesión
* conexión
* webhook
* integración
* trigger
* conversación
* analytics
* usuario
* archivo
* runtime

pertenece obligatoriamente a un tenant.

---

## 2. Arquitectura Modular

Cada módulo tiene:

* responsabilidad única
* contratos propios
* tests propios
* validadores propios
* runtime propio

Nunca:

* mega servicios
* archivos gigantes de lógica mezclada
* if/switch enormes
* responsabilidades múltiples

---

## 3. Runtime desacoplado del Builder

El editor visual NO controla el runtime.

Builder:

* diseña flows
* valida
* versiona
* publica

Runtime:

* ejecuta
* procesa sesiones
* enruta
* evalúa condiciones
* maneja estados

---

## 4. Sistema basado en eventos

La plataforma NO es lineal.

Es event-driven.

Eventos:

* mensaje recibido
* timeout
* reconnect
* webhook
* trigger
* handoff
* IA
* pixel
* integración
* respuesta
* retry
* reconnect

Todo el runtime gira alrededor de eventos.

---

## 5. Node System profesional

Los nodos NO son simples componentes visuales.

Cada nodo es un módulo operacional completo.

Cada nodo tendrá:

* definición
* schema
* runtime
* validator
* analytics
* serialización
* metadata UI
* outputs
* tests
* observabilidad

---

# Estructura Global de la Plataforma

> **Nota.** El esbozo original de este documento proponía una carpeta plana `modules/`. La estructura que finalmente se implementó separa aplicaciones desplegables, dominios de negocio, capacidades transversales e infraestructura, y es la que rige:
>
> **La referencia vigente es [`structure.md`](structure.md).** El esbozo se conserva abajo como registro de la intención original; no describe el repositorio actual.

Estructura vigente, resumida:

```txt
apps/              api · worker · web
domains/           automations · sessions · conversations · contacts · connections
                   integrations · billing · analytics · team · ai-agents
flow-engine/       motor de ejecución de automatizaciones (raíz, no es un dominio)
ai-sales-engine/   motor de ventas con IA (raíz, unidad independiente)
platform/          identity · authorization · tenancy · usage
                   configuration · observability · security
infrastructure/    persistence · cache · queue · storage · providers
contracts/         contratos de frontera
```

Correspondencias con el esbozo original: `access` → `platform/authorization`, `tenants` → `platform/tenancy`, `automation-builder` → `domains/automations/builder`, `automation-runtime` → `flow-engine`, `flow-catalog` → `domains/automations/catalog`, `flow-nodes` → `flow-engine/nodes`, `sessions` → `domains/sessions`, `subscriptions` → `domains/billing`, `workers` → `apps/worker`, `infra/` → `infrastructure/`.

`triggers`, `webhooks` y `notifications` no tienen todavía una frontera propia: se ubicarán cuando exista implementación real.

Esbozo original (histórico):

```txt
modules/
  access/
  analytics/
  automation-builder/
  automation-runtime/
  billing/
  connections/
  conversations/
  contacts/
  flow-catalog/
  flow-nodes/
  integrations/
  notifications/
  sessions/
  subscriptions/
  tenants/
  triggers/
  webhooks/
  workers/

infra/
  postgres/
  redis/
  queue/
  observability/

frontend/
  dashboard/
  automations/
  conversations/
  integrations/
  billing/
  contacts/
  settings/
```

---

# Módulos Principales

# 1. Dashboard

## Función

Panel principal operacional.

Mostrará:

* conexiones activas
* conversaciones activas
* flows activos
* métricas
* eventos recientes
* errores
* estado runtime
* consumo
* analytics

---

# 2. Conversaciones

## Función

Inbox operacional en tiempo real.

Similar a:

* CRM conversacional
* WhatsApp operator center

## Capacidades

* conversaciones activas
* filtros
* estados
* etiquetas
* asignación humana
* departamentos
* mensajes en tiempo real
* media
* audio
* notas internas
* variables del contacto
* handoff
* IA opcional

---

# 3. Automatizaciones

## Función

Centro de flows.

Desde aquí:

* crear flows
* organizarlos por carpetas
* duplicar
* importar
* exportar
* archivar
* versionar
* publicar
* rollback

---

# Estructura de Automatizaciones

## Carpetas

Las carpetas son organizadores lógicos.

Ejemplo:

* Ventas
* Soporte
* Nutrición
* Venezuela
* Colombia
* Meta Ads
* WhatsApp

Las carpetas:

* soportan subcarpetas
* orden visual
* búsqueda
* filtros
* tags

---

# Flow

Un flow es:

```txt
un grafo versionado de automatización
```

Compuesto por:

* nodos
* edges
* triggers
* metadata
* analytics
* versiones

---

# Estados del Flow

* draft
* published
* paused
* archived

---

# Versionado

Cada publicación crea:

```txt
snapshot inmutable
```

Las sesiones activas:

* siguen atadas a la versión original
* no migran automáticamente

---

# Flow Builder

Editor visual profesional.

## Capacidades

* drag and drop
* zoom
* minimap
* validación visual
* edges inteligentes
* outputs dinámicos
* simulación
* autosave
* versionado
* publicación
* rollback
* paneles laterales

---

# Arquitectura del Builder

```txt
Builder UI
  ↓
Builder State
  ↓
Flow Snapshot Compiler
  ↓
Graph Validator
  ↓
Version Registry
  ↓
Runtime Snapshot
```

---

# Sistema de Nodos

# Filosofía

Cada nodo es:

```txt
plugin operacional aislado
```

NO:

```txt
switch(node.type)
```

---

# Arquitectura de Nodos

```txt
flow-nodes/
  message/
    contracts/
    runtime/
    validation/
    ui/
    analytics/
    tests/

  condition/
  delay/
  ai/
  integration/
  notification/
  pixel/
  handoff/
```

---

# Contrato Base del Nodo

Cada nodo tendrá:

```ts
NodeDefinition
```

Con:

* type
* category
* icon
* outputs
* configSchema
* validator
* runtimeHandler
* uiRenderer
* analyticsHooks

---

# Categorías de Nodos

## Comunicación

* mensaje
* menú
* carrusel
* audio
* archivo
* imagen
* sticker

---

## Conversación

* esperar respuesta
* controlador de chat
* departamento
* handoff
* operador

---

## Routing

* condicional
* distribuidor
* conexión de flow
* fallback

---

## Tiempo

* delay
* intervalo inteligente
* schedule

---

## Integraciones

* webhook
* integración HTTP
* pixel
* eventos
* API externas

---

## IA

* GPT
* Gemini
* clasificación
* OCR
* comprobantes
* embeddings

---

## Negocio

* venta aprobada
* etiquetas
* variables
* manipulación de contexto
* CRM

---

# Nodo Mensaje

## Responsabilidad

Enviar mensajes al usuario.

## Soporta

* texto
* imagen
* audio
* video
* sticker
* archivo
* contactos
* botones
* listas

## Capacidades

* typing simulation
* audio recording simulation
* visualización única
* captions
* markdown
* variables dinámicas

## Runtime interno

```txt
MessageRenderer
MediaUploader
WhatsAppFormatter
TypingSimulator
DeliveryTracker
```

---

# Nodo Esperar Respuesta

## Responsabilidad

Suspender sesión hasta nuevo evento.

## Capacidades

* timeout
* buffer
* fallback
* capturas
* reaction support
* wait indefinitely

## Runtime

* session suspension
* event listener
* timeout scheduler
* resume engine

---

# Nodo IA

## Responsabilidad

Integrar proveedores IA.

## Capacidades

* GPT
* Gemini
* OCR
* clasificación
* audio
* imágenes
* PDFs
* variables
* outputs condicionales

## Runtime

```txt
ProviderResolver
PromptCompiler
VariableInterpolator
ResponseParser
ConditionalClassifier
TokenTracker
```

---

# Nodo Integración

## Responsabilidad

Ejecutar llamadas HTTP.

## Capacidades

* GET
* POST
* PUT
* DELETE
* headers
* body
* variables
* mapping
* retries
* timeouts

## Runtime

```txt
HttpExecutionEngine
RetryPolicy
TimeoutPolicy
ResponseMapper
SecretResolver
```

---

# Nodo Distribuidor

## Responsabilidad

Distribuir contactos entre múltiples rutas.

## Capacidades

* round robin
* sticky sessions
* weighted distribution
* anti-repeat
* deterministic routing

---

# Nodo Pixel

## Responsabilidad

Enviar eventos Meta/Facebook.

## Capacidades

* purchase
* lead
* conversion
* dynamic values
* WhatsApp page mapping

---

# Nodo Notificación

## Responsabilidad

Enviar alertas internas.

## Capacidades

* WhatsApp
* email
* internal alerts
* formatting
* variables

---

# Runtime Conversacional

# Función

Ejecutar flows activos.

---

# Runtime Engine

## Responsabilidades

* ejecutar nodos
* resolver edges
* mantener sesiones
* persistir estado
* procesar eventos
* reanudar flows
* ejecutar delays
* retries
* handoff

---

# Componentes Runtime

```txt
ExecutionOrchestrator
ExecutionLoop
NodeRuntime
EdgeEvaluator
SessionService
ContextService
ConversationService
EventDispatcher
```

---

# Sessions

Cada conversación activa crea:

```txt
session runtime
```

Contiene:

* currentNodeId
* versionId
* tenantId
* context
* status
* revision
* timestamps

---

# Persistencia

> **Nota.** Lo que sigue registra la intención original del producto, incluyendo motores concretos. La regla arquitectónica vigente es más estricta y deliberadamente agnóstica: **persistencia relacional basada en SQL, con los dominios dependiendo de contratos y nunca de una implementación concreta**. El motor concreto es una decisión de infraestructura, revisable sin tocar lógica de negocio. Ver [`persistence.md`](persistence.md).

# PostgreSQL

Persistencia durable.

## Guardará

* tenants
* usuarios
* flows
* versiones
* sesiones
* conversaciones
* analytics
* billing
* contactos
* integraciones

---

# Redis

## Uso

* cache
* locks
* queues
* sessions activas
* rate limiting
* pub/sub

---

# Workers

## Responsabilidades

* delays
* retries
* integrations
* notifications
* IA
* scheduling
* analytics async

---

# Seguridad

# Auth

* JWT
* API Keys
* scopes
* roles
* tenant isolation

---

# Roles

* owner
* admin
* operator
* analyst
* viewer

---

# Scopes

* flows.read
* flows.publish
* runtime.execute
* conversations.read
* conversations.reply
* analytics.read
* tenant.manage

---

# Billing

# Modelo

Billing por conexiones.

Cada tenant tiene:

* slots
* límites
* plan
* addons
* upgrades

---

# Connections

Cada conexión representa:

* WhatsApp instance
* número
* estado
* provider
* limits
* runtime binding

---

# Trigger System

# Función

Disparar automatizaciones.

## Tipos

* keyword
* welcome
* timeout
* reopen
* completed
* webhook
* external event

---

# Configuración por Conexión

Cada conexión puede:

* tener flows distintos
* triggers distintos
* configuraciones distintas

---

# Integraciones

# Meta

* campañas
* pixels
* perfiles
* cuentas
* conversions API

---

# Webhooks

* entrada externa
* mapping
* transformaciones
* triggers

---

# Analytics

## Métricas

* mensajes
* conversiones
* sesiones
* tiempos
* errores
* costos IA
* latencias
* throughput

---

# Observabilidad

# Logs estructurados

Cada ejecución tendrá:

* traceId
* tenantId
* flowId
* sessionId
* nodeId
* executionId

---

# Testing

# Obligatorio

Cada módulo tendrá:

* unit tests
* integration tests
* graph tests
* runtime tests
* security tests
* tenant isolation tests

---

# Reglas Arquitectónicas

# Nunca

* lógica mezclada
* archivos gigantes
* mutable shared state
* acceso cross-tenant
* runtime acoplado UI
* builders acoplados runtime
* mega hooks
* mega services

---

# Siempre

* SRP
* contratos canónicos
* readonly
* validadores fuertes
* DI
* observabilidad
* tests reales
* runtime desacoplado
* versionado inmutable

---

# Objetivo Final

Construir una plataforma:

* moderna
* enterprise
* multi-tenant
* extensible
* modular
* visualmente profesional
* escalable
* preparada para millones de mensajes
* preparada para múltiples canales
* preparada para crecimiento internacional
* preparada para IA modular futura

Sin destruir la arquitectura base.



*ejemplos de nodos por ejemplo el de message:

    flow-nodes/
  message/
    contracts/
      MessageNodeConfig.ts
      MessageNodeResult.ts

    runtime/
      MessageNodeHandler.ts
      MessageRenderer.ts
      MediaUploader.ts
      TypingSimulator.ts
      WhatsAppFormatter.ts

    validation/
      validateMessageNode.ts

    ui/
      MessageNodeEditor.tsx
      MessageContentEditor.tsx
      MessageMediaEditor.tsx

    analytics/
      MessageNodeMetrics.ts

    tests/
      MessageNodeHandler.test.ts
      validateMessageNode.test.ts