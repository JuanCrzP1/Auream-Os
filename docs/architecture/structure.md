# Estructura del repositorio

Estructura definitiva. Los niveles superiores no se rediseñan: se llenan.

```
bots-ai-platform/
├── apps/                  aplicaciones desplegables
│   ├── api/               entrypoint HTTP + composición
│   ├── worker/            entrypoint de procesos asíncronos
│   └── web/               SPA de la plataforma
├── domains/               bounded contexts de negocio
├── flow-engine/           motor de ejecución de automatizaciones
├── ai-sales-engine/       motor de ventas conversacionales con IA
├── platform/              capacidades transversales
├── infrastructure/        adapters concretos
├── contracts/             contratos de frontera
├── scripts/dev/           launchers de desarrollo
├── config/                configuración técnica compartida
├── docs/                  documentación
├── tests/                 pruebas que cruzan fronteras
└── data/                  datos locales de runtime (ignorado por git)
```

## Por qué estas capas

`apps/` existe porque hay tres unidades desplegables con ciclos de vida distintos. Son deliberadamente delgadas: componen y exponen, nunca deciden reglas de negocio. Si `api` y `worker` comparten lógica, esa lógica vive en `domains/`, no duplicada en cada app.

`domains/`, `platform/` e `infrastructure/` están al nivel raíz y no bajo un `backend/` porque `apps/web` ya identifica el frontend: todo lo demás es backend. Aplanar elimina un nivel de todas las rutas de import.

`packages/` no existe. Se añadirá el día que exista una librería compartida real; crearlo vacío sería una carpeta decorativa.

## apps/

| Carpeta | Responsabilidad | No contiene |
|---|---|---|
| `api/` | Servidor HTTP, middleware, rutas, composición de dependencias | Reglas de negocio, acceso directo a disco o red |
| `worker/` | Procesos asíncronos: reintentos, delays, jobs | Lógica duplicada de los dominios |
| `web/` | Interfaz de la plataforma | Lógica de negocio de servidor, acceso a `domains/` como código fuente |

`apps/api/composition/` es el composition root: el único lugar donde se instancian implementaciones concretas y se inyectan en los servicios de aplicación.

## domains/

Cada bounded context replica el mismo patrón interno:

```
<domain>/
├── domain/           entidades, invariantes, eventos      — sin imports externos
├── application/      casos de uso y puertos               — puede usar platform/ y contracts/
├── infrastructure/   implementa sus propios puertos       — puede usar infrastructure/
└── http/             adaptador HTTP del dominio           — delega en application/
```

No todos los dominios tienen las cuatro capas hoy; se añaden cuando hay contenido real que las justifique.

`automations` agrupa tres sub-módulos —`catalog`, `builder`, `validation`— porque son un producto cohesionado, no tres dominios. Versionar y publicar vive dentro de `builder`.

## Los dos motores

`flow-engine/` y `ai-sales-engine/` viven en la **raíz**, no bajo `domains/`. La razón es una distinción de naturaleza, no de gusto:

- `domains/` contiene **productos y bounded contexts de negocio** de la plataforma.
- Un motor es una **pieza técnica independiente** con su propio ciclo de vida.

`flow-engine` ejecuta grafos de automatización; `ai-sales-engine` es un motor de ventas conversacionales que se incorporará completo y sin modificaciones. No comparten código ni contratos.

`flow-engine` tiene estructura plana (`execution`, `edges`, `nodes`, `registry`, `ports`): una separación `domain/application` sirve a dominios con entidades y reglas de negocio, y aquí solo añadiría un nivel sin significado.

Ver [`flow-engine.md`](flow-engine.md) y [`ai-sales-engine.md`](ai-sales-engine.md).

## platform/

Capacidades que todos los dominios necesitan y que no pertenecen a ninguno: `identity`, `authorization`, `tenancy`, `configuration`, `observability`, `security`.

`usage` **no** está aquí: medir consumo alimenta límites y entitlements, así que pertenece a `domains/billing`. Esa decisión evita duplicar la responsabilidad en dos sitios.

Un dominio puede depender de `platform/`. `platform/` nunca depende de un dominio.

## infrastructure/

Todo lo que habla con el mundo exterior: drivers, clientes, pools, migraciones, SDKs.

```
infrastructure/
├── persistence/{json, memory}   implementaciones actuales
├── persistence/sql              implementado para tenancy (ver persistence.md)
├── cache/  queue/  storage/  providers/
```

## contracts/

Tipos de frontera compartidos: `FlowSnapshot` (estructura del grafo), `RuntimeContracts` (ejecución y mensajería), `BuilderContracts` (persistencia del builder).

La regla que rige qué entra: si el tipo cruza una frontera y es un dato puro de solo lectura, pertenece aquí. Una entidad con comportamiento pertenece a su dominio.

## scripts/, config/, docs/, tests/, data/

`scripts/dev/` contiene los launchers. No existen `scripts/build`, `scripts/test` ni `scripts/maintenance`: se crearán cuando haya un script real que colocar.

`config/tsconfig.base.json` centraliza las opciones de compilación; cada app extiende de él.

`tests/` guarda lo que cruza fronteras. Los tests unitarios pueden vivir junto a su módulo.

`data/` son datos de runtime escritos por la aplicación. Fuera del control de versiones. No es lugar para fixtures.

## Carpetas vacías

Varias carpetas existen como frontera arquitectónica sin contenido: los dominios `conversations`, `contacts`, `connections`, `integrations`, `ai-agents`; la capacidad `configuration`; los adapters `cache`, `queue`, `storage`, `providers`; y nueve features del frontend.

`team` y `persistence/sql` dejaron de estar vacías con Fase 1: la primera implementa membership y onboarding (ver [`boundaries.md`](boundaries.md)); la segunda, tenancy (ver [`persistence.md`](persistence.md)).

Git no versiona directorios vacíos, así que estas fronteras existen **en este documento**, no en el árbol clonado. No se añaden `.gitkeep`: la intención se documenta, no se simula con archivos vacíos.

Git no versiona directorios vacíos, así que no aparecen en el repositorio remoto hasta que tengan contenido. La frontera es la decisión; la carpeta es solo su reflejo.
