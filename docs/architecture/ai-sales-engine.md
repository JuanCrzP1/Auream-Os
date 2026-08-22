# AI Sales Engine

`ai-sales-engine/` — raíz del proyecto.

## Regla previa

**Este motor no se toca.** No se mueve, renombra, refactoriza, reorganiza ni edita. Este documento describe únicamente su posición arquitectónica y la frontera por la que se integrará; no documenta su interior, porque su interior no es asunto de la plataforma.

## Qué es

Un motor independiente de ventas conversacionales con IA. Es un sistema completo con sus propias decisiones internas: lógica comercial, prompts, memoria, orquestación y precios.

No es una librería de la plataforma ni un módulo de un dominio. Es un motor externo que la plataforma administrará.

## Por qué vive en la raíz

La plataforma tiene **dos motores independientes**, y ambos son hermanos de primer nivel:

```
bots-ai-platform/
├── flow-engine/        motor de ejecución de automatizaciones
└── ai-sales-engine/    motor de ventas conversacionales con IA
```

Ninguno vive bajo `domains/`, porque `domains/` contiene productos y bounded contexts de negocio de la plataforma, y un motor no es eso: es una pieza técnica con su propio ciclo de vida.

`ai-sales-engine/` está además en la raíz —y no dentro de `flow-engine/` ni de `apps/`— para que conserve su estructura interna sin tener que adoptar las convenciones de la plataforma. Puede traer su propio `package.json`, su propio build y su propia disposición de carpetas.

## Los dos motores no se mezclan

| | flow-engine | ai-sales-engine |
|---|---|---|
| Ejecuta | Grafos de automatización versionados | Conversaciones de venta |
| Lo alimenta | Una versión publicada desde Automations | Su propia lógica comercial |
| Lo administra | `domains/automations` | `domains/ai-agents` |
| Documento | [`flow-engine.md`](flow-engine.md) | este |

No comparten código, ni contratos, ni estado. Un flow puede contener un nodo de tipo `ai`, pero ese nodo pertenece al `flow-engine` y hoy es un stub: **no es** el AI Sales Engine ni lo invoca.

## La frontera de integración

```
apps/web/src/features/ai-agents      administración desde la interfaz
        ↓ HTTP
apps/api                             expone el dominio
        ↓
domains/ai-agents                    caso de uso + PUERTO
        ↓ único punto de contacto
ai-sales-engine/                     el motor, intacto
```

`domains/ai-agents` declarará un puerto con lo que la plataforma necesita del motor, y un adaptador lo implementará traduciendo entre los conceptos de la plataforma —tenant, plan, canal, activación— y la API que el motor exponga.

**Reglas de la frontera:**

1. Solo `domains/ai-agents` habla con el motor. Ningún otro dominio, y en ningún caso el frontend, lo importa.
2. La relación es unidireccional: el motor nunca importa código de la plataforma.
3. La plataforma depende del puerto que declara, no de la estructura interna del motor.
4. Cuando se incorpore, se coloca completo y sin modificaciones. No se fragmenta ni se reparten sus archivos entre dominios.

## Reparto de responsabilidades

**La plataforma administra:** activación por tenant, configuración del agente, capacidades habilitadas, canales asociados, estado y entitlements según plan.

**El motor posee:** la lógica conversacional y comercial, prompts, memoria, decisiones de venta, su orquestación interna y **el handoff a un asesor humano**.

La plataforma decide *si este tenant puede usar un agente y con qué configuración*. El motor decide *qué decir y cómo vender*.

## El handoff pertenece a este motor

Derivar una conversación a un asesor humano es una **decisión comercial**, no un paso de un grafo determinístico: depende de la intención del comprador, del contexto de la venta y de la disponibilidad del equipo.

Por eso el Flow Engine **no** tiene nodo `handoff` ni estado `handed_off`. Existieron y se retiraron: estaban incrustados en `NodeType`, en `ExecutionStatus`, en `SessionStatus` y en una rama del `ExecutionLoop`.

No se creó un handoff sustituto en ningún otro módulo. La responsabilidad queda **reservada** para este motor, sin implementación.

## Estado

`NO IMPLEMENTADO`. `ai-sales-engine/` está vacío y reservado. `domains/ai-agents/` está vacío. No existe puerto, adaptador ni integración.

`apps/web/src/features/ai-agents/` contiene una página placeholder alcanzable desde el sidebar.

Este documento describe la frontera acordada, no código presente. Ver también [`ai-agents.md`](ai-agents.md).
