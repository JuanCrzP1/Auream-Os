# Reglas de dependencias

Reglas normativas. Cada una es verificable con una búsqueda mecánica, y esa verificación aparece al final del documento.

## Dirección permitida

```
apps/api · apps/worker
      ↓ compone
domains/*/application  ──usa──>  platform/*  ·  contracts/*
      ↓ usa                              ↑
domains/*/domain                  infrastructure/*
                                    implementa los puertos

apps/web  ──HTTP──>  apps/api        (nunca import de código fuente)
```

## Reglas

### 1. Un dominio no importa infraestructura concreta

`domains/*/domain` y `domains/*/application` declaran puertos (interfaces). La implementación concreta se inyecta desde `apps/api/composition/`.

Un dominio no sabe si sus datos viven en JSON, en memoria o en una base SQL.

Cuando ensamblar algo exige instanciar infraestructura, ese ensamblaje pertenece a la composición, no al dominio. Por eso `BuilderSimulationRuntimeFactory` vive en `apps/api/composition/` y el dominio solo conoce el puerto `SimulationRuntimeFactory`.

### 2. Un dominio no importa otro dominio

Si un dominio necesita algo de otro, declara un puerto y lo consume; no importa sus clases.

Los puertos del runtime están en `flow-engine/ports/RuntimePorts.ts`: `SessionStore`, `ContextWriter`, `TenantContextResolver`, `AnalyticsSink`. Los dominios `sessions` y `analytics` y la capacidad `platform/tenancy` los satisfacen estructuralmente, sin acoplamiento de importación.

Si dos dominios necesitan el mismo tipo de dato, ese tipo sube a `contracts/`.

**Única excepción dirigida:** `automations` → `flow-engine`, y solo a través de interfaces (`FlowRegistry`, `FlowExecutor`) con `import type`. Es la frontera producto → motor: Automations publica versiones, el motor las ejecuta. La dirección inversa está prohibida: el motor no conoce Automations.

```
automations  ──import type──>  flow-engine  ──puertos──>  sessions · analytics
```

### 3. El dominio no depende del framework

`domains/*/domain` no importa nada externo salvo `contracts/`. Sin HTTP, sin SQL, sin librerías de servidor.

### 4. `platform/` es transversal y no contiene negocio

Un dominio puede depender de `platform/`. `platform/` nunca depende de un dominio.

`authorization` define qué es un rol; `team` gestiona qué miembro tiene cuál. Esa separación es la prueba: si el código habla de un área de producto concreta, no pertenece a `platform/`.

### 5. `apps/` compone, no decide

`apps/api` y `apps/worker` cablean e inyectan. Toda regla de negocio vive en `domains/`, para que ambas apps la reutilicen sin duplicarla.

### 6. El frontend no importa código del backend

`apps/web` se comunica exclusivamente por HTTP. Nunca importa de `domains/`, `platform/` ni `infrastructure/`.

### 7. `contracts/` contiene contratos, no entidades internas

Entra un tipo si cruza una frontera y es dato puro de solo lectura. No entra una entidad con comportamiento ni un tipo que solo usa un módulo.

### 8. `shared` exige dos consumidores

En `apps/web/src/shared/`, un módulo con un solo consumidor pertenece a esa feature. La regla es mecánica y auditable, y es lo que impide que `shared` se convierta en un cajón de sastre.

### 9. Todo dato pertenece a un tenant

Los puertos de repositorio exigen `tenantId`. No existe un `list()` sin tenant, solo `listByTenant(tenantId)`. La frontera de aislamiento se impone en la firma, no en la disciplina de quien llama.

### 10. El motor externo es unidireccional

Solo `domains/ai-agents` puede hablar con `ai-sales-engine/`, a través de un adaptador. El motor nunca importa código de la plataforma.

### 11. `contracts/` es la fuente única, también para el frontend

Un contrato de API **no es** la entidad de dominio. Cuando la respuesta HTTP necesita otra forma —aplanar campos, ocultar `tenantId`— se declara un contrato explícito en `contracts/` y la traducción vive en un único punto de `apps/api/`. Lo prohibido es que el frontend **invente** su propia versión de lo que recibe.

Prohibido redefinir un contrato compartido en cualquier otro módulo. `apps/web` los consume por el alias `@contracts/*`, declarado en su `tsconfig.json`, `vite.config.ts` y `vitest.config.ts`.

Existió una copia paralela en `apps/web/src/shared/types/flow.ts` que duplicaba `NodeType`, `BuilderFlowNode`, `BuilderFlowEdge`, `BuilderFlowSnapshot`, `PersistedBuilderWorkspace` y `NodeExecutionResult`. Se eliminó: permitía que frontend y backend divergieran en el modelo de grafo sin que el typecheck lo detectara.

### 12. Un archivo, una responsabilidad — máximo 200 líneas

Ningún `.ts` ni `.tsx` supera 200 líneas. Un `.css` que los supere debe revisarse por mezcla de responsabilidades.

El límite no es estético: obliga a que cada archivo tenga un motivo único para cambiar. Cuando un archivo crece, casi siempre es porque absorbió una segunda responsabilidad.

### 13. No se finge funcionalidad

Si una integración no existe, el código **falla de forma explícita**; nunca devuelve un resultado inventado que la haga parecer operativa. Un `mockResult` en la ruta de ejecución real es un defecto, no un atajo.

La simulación del builder puede tener sus propios mecanismos, pero no se mezclan con la ejecución real.

### 14. Ninguna credencial en el código

No se hardcodean credenciales, ni siquiera de desarrollo. Vienen del entorno, y las de desarrollo no pueden existir en producción: la API se niega a arrancar si `DEV_API_KEY` aparece con `NODE_ENV=production`.

CORS funciona por allowlist. `Access-Control-Allow-Origin: *` está prohibido.

## Prohibiciones explícitas

- `domains/*` → `infrastructure/*` concreto
- `domains/<a>` → `domains/<b>` (salvo `automations` → interfaces de `flow-engine`)
- `flow-engine` → `automations`, `sessions` o cualquier otro dominio
- `flow-engine` → frontend, React o canvas
- `automations` → clases concretas de `flow-engine`
- `platform/*` → `domains/*`
- `apps/web` → cualquier código fuente del backend
- Cualquier módulo salvo `domains/ai-agents` → `ai-sales-engine/`
- SQL en `domain/` o `application/`: toda consulta vive detrás de un puerto
- Dos implementaciones paralelas del mismo concepto (por ejemplo, dos resolvers de tenant o dos servicios de publicación)
- Redefinir en cualquier módulo un contrato que ya vive en `contracts/`
- Un nodo o estado de handoff dentro de `flow-engine` (pertenece al AI Sales Engine)
- Credenciales hardcodeadas y `Access-Control-Allow-Origin: *`

## Verificación

```bash
# 1. dominios → infraestructura concreta        (esperado: 0)
grep -rn "infrastructure/" domains --include=*.ts | wc -l

# 2. cruces entre dominios                       (esperado: 0)
grep -rEn "\.\./(\.\./)*(sessions|analytics|billing|contacts|connections|integrations|team|conversations|ai-agents)/" \
  domains/automations flow-engine --include=*.ts | wc -l

# 2b. el motor no conoce a nadie                  (esperado: 0)
grep -rn "automations/\|infrastructure/" flow-engine --include=*.ts | wc -l

# 2c. automations solo cruza por tipos            (esperado: vacío)
grep -rn "flow-engine/" domains/automations --include=*.ts | grep -v "import type"

# 3. frontend → código del backend               (esperado: 0)
grep -rn "/domains/\|/platform/\|/infrastructure/" apps/web/src | wc -l

# 4. imports profundos en el frontend            (esperado: 0)
grep -rEoh "(\.\./){3,}" apps/web/src | wc -l

# 5. contratos duplicados en el frontend         (esperado: 0)
grep -rn "shared/types/flow\|list/types/automation" apps/web/src apps/web/tests | wc -l

# 5b. tipos declarados dos veces en codigo propio (esperado: vacío)
grep -rhoE "^export (interface|type) [A-Za-z0-9_]+"   apps/api apps/worker apps/web/src domains flow-engine platform infrastructure contracts   --include=*.ts --include=*.tsx | awk '{print $3}' | sort | uniq -d

# 6. handoff dentro del motor                    (esperado: 0)
grep -rni "handoff\|handed_off" flow-engine contracts --include=*.ts | wc -l

# 7. archivos TS/TSX de mas de 200 lineas        (esperado: vacío)
find . -type f \( -name "*.ts" -o -name "*.tsx" \)   -not -path "*/node_modules/*" -not -path "*/dist/*"   -exec wc -l {} \; | awk '$1>200'

# 8. credenciales hardcodeadas / CORS abierto    (esperado: 0)
grep -rn "Allow-Origin\", \"\*\"\|bfk_" apps --include=*.ts --include=*.tsx | wc -l
```

Estas comprobaciones son baratas y deberían ejecutarse antes de cada integración.
