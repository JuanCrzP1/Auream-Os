# infrastructure/persistence

## Regla

Los puertos de persistencia **los declara el dominio que los necesita**, no esta carpeta.

`domains/automations/.../BuilderWorkspaceRepository.ts`, `AutomationRepository.ts`,
`FolderRepository.ts` y `domains/sessions/.../SessionRepository.ts` son los contratos.
Aquí viven únicamente las **implementaciones** que los satisfacen.

Por eso `ports/` no contiene código: duplicar aquí las interfaces crearía dos
fuentes de verdad. Este documento existe para dejar constancia de la decisión.

## Implementaciones

| Carpeta | Estado | Uso |
|---|---|---|
| `json/` | IMPLEMENTADO | Sólo desarrollo local. No es la persistencia definitiva. |
| `memory/` | IMPLEMENTADO | Simulación del builder y tests. Sin durabilidad. |
| `sql/` | NO IMPLEMENTADO | Destino de producción. Ver abajo. |

## Destino: SQL sobre Neon

La persistencia de producción será SQL, desplegada en Neon.

La regla es que **Neon no aparece en ningún dominio**. Un dominio depende de su
puerto de repositorio; el adaptador SQL vive en `sql/` y la elección se hace en
un único punto: `apps/api/composition/composeBuilderServices.ts`.

Migrar de JSON a SQL consiste en escribir los adaptadores en `sql/` y cambiar
esa composición. Ningún archivo de `domains/` debe modificarse.

`json/` se retirará cuando `sql/` esté operativo.
