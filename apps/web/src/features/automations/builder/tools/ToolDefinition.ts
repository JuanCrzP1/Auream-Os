import type { NodeType } from "@contracts/FlowSnapshot";

/**
 * Contrato de una herramienta del builder.
 *
 * Una herramienta es TODO lo que el builder necesita saber para ofrecer, pintar
 * y editar un tipo de nodo. Antes esta información vivía repartida en cinco
 * mapas `Record<NodeType, …>` en archivos distintos (paleta, iconos, colores de
 * la tarjeta, textos por defecto, título del editor): añadir una herramienta
 * obligaba a tocar los cinco y olvidarse de uno no daba error hasta ejecutar.
 *
 * Ahora cada herramienta declara esto una sola vez, en su propio módulo, y el
 * registry es la única frontera que el core del builder consulta.
 *
 * Lo que NO entra aquí: la ejecución del nodo (eso es `flow-engine/nodes/`), la
 * validación estructural del grafo (eso es `domains/automations/validation`) ni
 * el estado del canvas.
 *
 * **Este módulo es puro: sin React, sin JSX.** El icono de cada herramienta vive
 * aparte, en `tools/icons.tsx`, porque `validateCanvasGraph` consulta el
 * registry y lo ejecuta también el test de paridad del backend, donde no hay
 * runtime de React. Una regla de validación no puede depender de un SVG.
 */
export interface ToolDefinition {
  /** Tipo canónico del contrato compartido. Es la clave del registry. */
  readonly type: NodeType;

  /** Nombre visible en la paleta y título por defecto de un nodo nuevo. */
  readonly label: string;

  /** Subtítulo de la paleta: qué hace la herramienta, en una línea. */
  readonly description: string;

  /** Texto inicial del contenido de un nodo recién creado. */
  readonly defaultContentText: string;

  /** Título del modal de edición. */
  readonly editorTitle: string;

  /**
   * `false` para nodos de sistema: existen en el modelo y se pintan si un flow
   * ya los contiene, pero el usuario no puede añadirlos desde la paleta.
   */
  readonly availableInPalette: boolean;

  /** Cierra una rama del flujo: sin edges salientes obligatorios. */
  readonly terminal: boolean;

  /**
   * `false` cuando el motor reconoce el tipo pero todavía no sabe ejecutarlo:
   * su handler falla explícitamente con `*_not_implemented`.
   *
   * Se declara aquí para que la plataforma pueda decir la verdad sobre lo que
   * una herramienta hace hoy. No se finge capacidad: si esto es `false`, un
   * flow que alcance el nodo se detiene.
   */
  readonly executable: boolean;

  /**
   * Configuración con la que nace un nodo de esta herramienta.
   *
   * Es la forma mínima válida, no una especificación de negocio: cuando una
   * herramienta todavía no tiene comportamiento definido, aquí va `{}` en lugar
   * de inventar campos que nadie ha acordado.
   */
  readonly defaultConfig: Readonly<Record<string, unknown>>;

  /** Paleta cromática de la herramienta en la tarjeta del canvas y la paleta. */
  readonly colors: {
    readonly header: string;
    readonly body: string;
    readonly gradient: string;
  };

  /** Glifo compacto de la cabecera de la tarjeta en el canvas. */
  readonly glyph: string;
}
