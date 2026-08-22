# AI Agents y AI Sales Engine

## Dos cosas distintas

| | Qué es | Dónde vive | Estado |
|---|---|---|---|
| **AI Agents** | Dominio de la plataforma: administra agentes | `domains/ai-agents/` | `NO IMPLEMENTADO` — frontera vacía |
| **AI Sales Engine** | Motor de ventas AI-first | `ai-sales-engine/` | `NO IMPLEMENTADO` — carpeta reservada y vacía |

El **handoff a un asesor humano** pertenece al AI Sales Engine, no al Flow Engine ni a Conversations. Ver [`ai-sales-engine.md`](ai-sales-engine.md).

El AI Sales Engine es independiente de `flow-engine`, `automations`, `conversations` y `connections`: no comparte código, contratos ni estado con ninguno.

«AI Agents» es el área de la plataforma que corresponde al AI Sales Engine. No es un sistema genérico de agentes, ni un motor alternativo.

## El motor permanece intacto

`ai-sales-engine/` es una unidad independiente en la raíz del repositorio, hermana de `apps/` y `domains/`.

Cuando se incorpore:

- se coloca **completo y sin modificaciones**, conservando su estructura interna;
- **no** se reorganiza, refactoriza ni fragmenta;
- **no** se reparten sus archivos entre `conversations`, `billing`, `contacts` ni ningún otro dominio;
- **no** se duplica su lógica en la plataforma.

Está en la raíz y no dentro de `backend/` precisamente para que no tenga que adoptar las convenciones internas de la plataforma.

## Reparto de responsabilidades

**La plataforma administra:** activación por tenant, configuración del agente, capacidades habilitadas, canales asociados, estado, entitlements según plan y registro de consumo.

**El motor posee:** la lógica conversacional y comercial, prompts, memoria, decisiones de venta, precios y orquestación interna.

La línea es nítida: la plataforma decide *si este tenant puede usar un agente y con qué configuración*; el motor decide *qué decir y cómo vender*.

## La frontera

```
apps/web/src/features/ai-agents        interfaz de administración
        ↓ HTTP
apps/api                               expone el dominio
        ↓
domains/ai-agents                      caso de uso + PUERTO
        ↓ único punto de contacto
ai-sales-engine/                       motor, intacto
```

`domains/ai-agents` declara un puerto que describe lo que la plataforma necesita del motor. Un adaptador lo implementa traduciendo entre los conceptos de la plataforma (tenant, plan, canal, activación) y la API que el motor exponga.

### Reglas

1. **Un solo punto de contacto.** Únicamente `domains/ai-agents` habla con el motor. Ningún otro dominio, y en ningún caso el frontend, lo importa.
2. **Relación unidireccional.** El motor nunca importa código de la plataforma.
3. **Contra un puerto, no contra internals.** La plataforma depende de la interfaz que declara, no de la estructura interna del motor. Así el motor puede evolucionar sin arrastrar a la plataforma.
4. **Sin lógica de negocio duplicada.** Si el motor necesita datos de contactos o registrar consumo, lo hace a través del adaptador, que llama a los puertos de aplicación de esos dominios.

## No confundir con el nodo `ai`

`flow-engine/nodes/ai/` es un tipo de nodo dentro del grafo de automatizaciones. Hoy es un stub que no invoca ningún proveedor.

Es un concepto **distinto** del dominio `ai-agents` y del AI Sales Engine. Comparten la sigla y nada más. No deben fusionarse sin una decisión explícita.

## Estado actual

`domains/ai-agents/` está vacía. `ai-sales-engine/` está vacía y reservada. `apps/web/src/features/ai-agents/` contiene una página placeholder alcanzable desde el sidebar.

No existe puerto, adaptador ni integración: este documento describe la frontera acordada, no código presente.
