# Documentación

## Arquitectura

| Documento | Contenido |
|---|---|
| [`architecture/vision.md`](architecture/vision.md) | Visión del producto: qué se construye y por qué |
| [`architecture/structure.md`](architecture/structure.md) | Estructura del repositorio y justificación de cada capa |
| [`architecture/boundaries.md`](architecture/boundaries.md) | Qué posee cada dominio y qué no debe absorber |
| [`architecture/dependency-rules.md`](architecture/dependency-rules.md) | Reglas de dependencia y cómo verificarlas |
| [`architecture/frontend.md`](architecture/frontend.md) | `apps/web`: app, features y shared |
| [`architecture/backend.md`](architecture/backend.md) | `apps/api`, `apps/worker`, dominios, platform e infraestructura |
| [`architecture/automations.md`](architecture/automations.md) | El producto: catalog, builder, validation |
| [`architecture/flow-engine.md`](architecture/flow-engine.md) | El motor de automatizaciones: ejecución, nodos, edges, registry y sus fronteras |
| [`architecture/ai-sales-engine.md`](architecture/ai-sales-engine.md) | El motor de ventas con IA: por qué es independiente y cómo se integrará |
| [`architecture/auth.md`](architecture/auth.md) | Identidad, sesión, tenant, membership, roles y autorización |
| [`architecture/tenancy.md`](architecture/tenancy.md) | Multi-tenancy: resolución, contexto, autorización, aislamiento |
| [`architecture/persistence.md`](architecture/persistence.md) | Persistencia SQL detrás de contratos, sin acoplar proveedor |
| [`architecture/ai-agents.md`](architecture/ai-agents.md) | Frontera con el AI Sales Engine |

## Desarrollo

| Documento | Contenido |
|---|---|
| [`development/README.md`](development/README.md) | Instalación, ejecución local, launchers, tests, build, troubleshooting |

## Por dónde empezar

Para entender el sistema: `vision.md` → `structure.md` → `boundaries.md`.

Para escribir código: `dependency-rules.md` y luego `frontend.md` o `backend.md` según el área.

Para levantar el proyecto: [`development/README.md`](development/README.md).

## Convención

Cada documento marca el estado de lo que describe:

| Estado | Significado |
|---|---|
| `IMPLEMENTADO` | Código funcional, conectado y probado |
| `PREPARADO` | Código o contrato que existe y compila, pero sin consumidor |
| `NO IMPLEMENTADO` | Sólo frontera arquitectónica; no hay código |

La documentación describe lo que existe. Cuando algo está pendiente, se dice explícitamente en lugar de redactarlo como si ya funcionara.
