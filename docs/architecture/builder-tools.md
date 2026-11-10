# Herramientas del Builder

`apps/web/src/features/automations/builder/tools/`

## Qué es

Cada tipo de nodo del lienzo (Mensaje, Esperar respuesta, Programador, Distribuidor…) es una **herramienta**: un módulo autocontenido que el núcleo del builder descubre por contrato. El núcleo (lienzo, paleta, marco del editor, adaptadores) **no conoce ninguna herramienta concreta**.

## Reglas compartidas (`contracts/blocks/`)

Lo que NO es visual de cada bloque vive una sola vez en `contracts/blocks/` y lo comparten el editor web y el servidor MCP (los agentes de IA editan flujos con las mismas reglas que una persona):

| Archivo | Qué decide |
|---|---|
| `BlockRules.ts` | El contrato: tipo, nombre, contenido y configuración con que nace, si se ofrece en la paleta, si cierra una rama, sus salidas, si está listo (`validate`) y su forma canónica (`normalizeConfig`, con los lectores de `contracts/*Config.ts`) |
| `blockCatalog.ts` | Las reglas de los 14 tipos (`MENU_BLOCK`, `MESSAGE_BLOCK`…), `findBlockRules`, `blockOutputs` |
| `outputs.ts` · `validation/*` | Salidas con nombre y validación de cada bloque |
| `connectionRules.ts` | ¿Se puede trazar esta conexión? (una por salida, nada llega al inicio, salidas que existan) |
| `reviewFlow.ts` | «Revisión del flujo»: errores y avisos, bloque a bloque |

Una herramienta del editor es `{ ...X_BLOCK, <lo visual> }`; `tests/contract/blockCatalogParity.test.ts` impide que declare reglas propias. Los `validate*.ts`, `connectionRules.ts`, `reviewFlow.ts` y `nodeOutputs.ts` del editor solo adaptan el lienzo al grafo de `contracts/blocks/FlowGraph.ts`.

## Estructura

```
tools/
├── ToolDefinition.ts     reglas compartidas (BlockRules) + lo visual puro (sin React)
├── ToolUi.ts             contrato VISUAL (React)
├── registry.ts           catálogo puro — única frontera para el núcleo
├── ui-registry.tsx       catálogo visual
├── _kit/                 primitivas compartidas por las herramientas
│   ├── Switch.tsx        SwitchControl y SwitchField (role="switch")
│   ├── OutputHandle.tsx  punto de salida con nombre
│   ├── useAutoHeight.ts  textarea que crece con su contenido
│   ├── createLocalId.ts  ids locales únicos
│   ├── layout.tsx        ToolEditorLayout (cabecera), CardSection (paso numerado),
│   │                     ChoiceCards, OutputsPreview, EmptyState, Joiner, ChatPreview
│   ├── fields.tsx        campos, Select, ChipsField, ListCard, Add/RemoveButton, VariableHint
│   ├── icons.tsx         iconos de las tarjetas de elección
│   ├── OutputsCompactBody.tsx  nodo cerrado genérico con salidas con nombre
│   ├── read.ts           lectores defensivos (string, enum, listas con id…)
│   ├── catalogs.ts       monedas, prefijos de país, variables de contacto
│   └── kit.css
└── <herramienta>/
    ├── definition.ts     su ToolDefinition
    ├── ui.tsx            su ToolUi
    ├── read*.ts          lector defensivo de la config
    ├── validate*.ts      ¿puede guardarse? (reexporta contracts/blocks/validation)
    ├── summarize*.ts     resumen de una línea
    ├── *CompactBody.tsx  nodo cerrado
    ├── *Editor.tsx       editor
    └── editor/           piezas del editor
```

## Reglas de dependencia

| Desde | Puede importar | No puede importar |
|---|---|---|
| Una herramienta | `_kit/`, `ToolDefinition`, `ToolUi`, `ToolResources`, `@contracts/*` | Otra herramienta, el núcleo del builder (salvo el tipo `NodePatch`) |
| `_kit/` | React, React Flow | Ninguna herramienta |
| El núcleo | `registry`, `ui-registry`, `ToolDefinition`, `ToolUi` | El interior de una herramienta |
| `definition.ts` y su cadena | Módulos puros (`.ts`) | Cualquier `.tsx`: el test de paridad del backend corre en Node sin React |

Lo vigilan los tests de arquitectura (`toolRegistry`, `toolUiRegistry`, `distributorArchitecture`, `intervalArchitecture`) y `tests/contract/toolRegistryParity.test.ts`.

## Recursos de la cuenta en los editores

Algunos editores usan cosas de la cuenta al configurar:

- **Datos para ofrecer**: el catálogo de etiquetas (el bloque Etiquetas muestra la LISTA de la cuenta, con su color, para marcar o desmarcar; la regla «Etiqueta» del Condicional las autocompleta) y las conexiones de IA de la cuenta (sin claves, con su estado). Mañana, píxeles.
- **Capacidades**: `createLabel`, `testIntegration`, `createAiCredential` (conectar una IA sin salir del bloque), `listAiModels` (los modelos reales de esa cuenta del proveedor) y `testAi` («Probar» la Extensión IA), `testPixel` (el Pixel, que exige el código de prueba de Meta; el bloque no conecta píxeles: eso se hace solo en Meta Ads), `testPaymentProof` («Probar» el Comprobante con una imagen o PDF de ejemplo; reduce las fotos en el navegador), `products` (el catálogo de Ventas para Registrar venta; el bloque no crea productos: eso se hace en Ventas → Productos) y `uploadMedia` (subir archivos de los mensajes). No lanzan: devuelven un resultado o un mensaje para mostrar.

- Llegan por props, en `ToolEditorProps.resources` (`tools/ToolResources.ts`). Son opcionales: un editor funciona igual sin ellos.
- Los carga el builder una vez por pantalla (`context/BuilderResourcesContext.tsx`, con `useLabelCatalog` de `shared/labels`) y el marco del nodo abierto los pasa al editor. La herramienta nunca llama a la API ni conoce el contexto.
- Son sugerencias, no validación: un flujo puede nombrar una etiqueta que aún no existe; el motor la crea al ejecutarse.

Para añadir un recurso nuevo: ampliar `ToolResources`, cargarlo en `BuilderResourcesProvider` y leerlo en el editor que lo necesite.

## Salidas con nombre

Una herramienta con varios caminos declara `outputs(config) → [{ id, label }]` en su definición. A partir de ahí:

- `FlowNodeCard` no pinta la salida única y le pasa las salidas al `CompactBody`, que pinta un `OutputHandle` por cada una.
- `FlowNodeCard` avisa a React Flow (`updateNodeInternals`) cuando la lista cambia.
- `useBuilderController` poda automáticamente las aristas cuya salida desapareció (`pruneCanvasEdges`), y los dos adaptadores aplican la misma regla al cargar y al guardar.
- Al cargar, una arista heredada sin `fromOutput` se asigna a la primera salida en vez de perderse.

El `id` de una salida es dato persistido (`fromOutput`): no se renumera ni se reutiliza.

Las reglas para conectar salidas (una conexión por salida, inicio, ciclos…) y lo pendiente en el motor están en [flow-connections.md](flow-connections.md).

## Configuración: dónde vive, cómo se lee, cómo evoluciona

- **Contrato compartido.** Si el motor lee la config, su forma vive en `contracts/` (`WaitResponseConfig`, `IntervalConfig`). Si no, vive en la carpeta de la herramienta y sube sin cambios el día que el motor la necesite.
- **Lector ≠ validador.** El lector responde «¿qué se puede pintar?»: nunca lanza, descarta lo ilegible y conserva lo incompleto. El validador responde «¿puede guardarse?» y mira el dato crudo.
- **Evolución.** El lector es la capa de migración: debe aceptar toda forma que se haya persistido alguna vez (ej. `mode` → `trigger` en el Programador), y el editor reescribe la forma actual en el siguiente guardado. Si un cambio de forma no se puede deducir de los datos, se añade `schemaVersion` a esa config y el lector migra por versión. No se migra nada en lote.
- **Ids locales** con `createLocalId` (bloques, salidas, aristas).

## Nodos de sistema

**Inicio** (`start`) y **Finalizar** (`end`) son herramientas registradas como las demás, pero con `availableInPalette: false`. No declaran `Editor`, así que no se editan: el lienzo no ofrece el lápiz y el doble clic no hace nada. Inicio tampoco se borra ni se duplica. Ver [flow-connections.md](flow-connections.md#el-bloque-de-inicio).

## Convenciones

- **Idioma.** Identificadores, archivos y clases CSS en **inglés**. Textos visibles y comentarios en **español**.
- **Comentarios.** Solo el *por qué* que no se deduce del código, en 1–3 líneas. La historia va en git, y las decisiones grandes en estos documentos.
- **Editores.** Toda herramienta configurable declara `Editor`; ya no existe un editor genérico de respaldo. Estructura fija: `ToolEditorLayout` (icono, título y qué hace el bloque) → `CardSection` numeradas en el orden en que se decide → `OutputsPreview` al final. Las decisiones importantes van en `ChoiceCards`; las listas vacías, en `EmptyState`; lo que ve el cliente, en `ChatPreview`.
- **Estilos.** Cada herramienta aporta su acento con variables (`--kit-switch-accent`, `--kit-switch-on-bg`…). Forma, tamaño, foco y movimiento son del kit.
- **Resultado de validación:** `ValidationResult` (`{ valid, reason }`) con `VALID` / `invalid(reason)`.

## Añadir una herramienta

1. `contracts/FlowSnapshot.ts` → el tipo en `NodeType`.
2. `flow-engine/nodes/<tipo>/` → handler (puede fallar con `*_not_implemented`).
3. `apps/api/composition/composeNodeRuntime.ts` → registrar el handler.
4. `contracts/blocks/` → sus reglas en `blockCatalog.ts` (y salidas/validación si tiene), y su guía para agentes en `apps/api/mcp/blocks/blockGuides.ts`.
5. `tools/<herramienta>/definition.ts` (`{ ...X_BLOCK, … }`) + `ui.tsx`.
6. Añadirlas a `registry.ts` y a `ui-registry.tsx`.
7. Reutilizar `_kit/` antes de escribir una primitiva nueva. Si una primitiva aparece en una segunda herramienta, se sube al kit.
