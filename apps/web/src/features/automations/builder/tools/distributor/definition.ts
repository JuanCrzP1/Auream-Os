import type { ToolDefinition } from "../ToolDefinition";
import { DISTRIBUTOR_DEFAULT_CONFIG } from "./distributorOutputs";
import { summarizeDistributor } from "./summarizeDistributor";
import { validateDistributor } from "./validateDistributor";

/**
 * Distribuidor — reparte la conversación entre varias salidas.
 *
 * `executable: false`, y sigue siéndolo. Lo que ya se puede hacer es DECLARAR
 * por dónde puede salir la conversación y dejar esos caminos conectados en el
 * lienzo; lo que todavía no existe es la política de reparto —turnos, peso,
 * fijar un contacto a una salida— ni el motor que la ejecute:
 * `DistributorNodeHandler` falla explícitamente con
 * `distributor_executor_not_implemented`. Declararlo ejecutable por tener ya
 * editor sería fingir capacidad, que es justo lo que esta bandera evita.
 *
 * No confundir con Condicional: el condicional decide por el contenido del
 * contexto; el distribuidor reparte sin mirarlo.
 *
 * NO DECLARA `duplicateConfig` NI `releaseResources`, y no por olvido. Sobre lo
 * segundo: no reserva nada fuera de su configuración. Sobre lo primero, que es
 * menos obvio —sus salidas SÍ llevan identidad—: los ids de dos nodos distintos
 * no se cruzan nunca, porque una arista guarda `fromOutput` junto al nodo del
 * que sale y se resuelve dentro de él. Un duplicado con los mismos ids de
 * salida es un nodo con las mismas salidas, que es exactamente lo que se espera
 * de un duplicado.
 */
export const distributorTool: ToolDefinition = {
  summarize: summarizeDistributor,
  validateContent: validateDistributor,
  type: "distributor",
  label: "Distribuidor",
  description: "Reparte entre varias salidas",
  defaultContentText: "Reparto entre salidas",
  editorTitle: "Editar distribuidor",
  availableInPalette: true,
  terminal: false,
  executable: false,
  // NACE SIN SALIDAS. La lista vacía la declara el módulo de salidas, que es su
  // dueño único: el editor y el lector ya la interpretan y no hace falta que
  // este archivo repita la forma.
  defaultConfig: { ...DISTRIBUTOR_DEFAULT_CONFIG },
  // PLATEADO DE ACERO. Identidad propia de la herramienta, en el mismo formato
  // en que las otras trece declaran la suya: color de cabecera, cuerpo y
  // degradado de la paleta. El editor repite estos tonos en `--ds-silver` y
  // `--ds-steel`.
  //
  // Antes llevaba el ámbar de aviso —el mismo par que Distribuidor y Esperar
  // respuesta compartían y que hacía que dos herramientas se leyeran como una—.
  // El metal no es de nadie más en el catálogo: ni azul (Mensaje), ni cyan
  // (Intervalo), ni el dorado de Esperar respuesta, ni el violeta del sistema.
  //
  // LA CABECERA SE OSCURECIÓ POR LEGIBILIDAD, no por gusto. El primer plateado
  // (`#a8b3c2`) dejaba el título blanco del nodo en 2.12:1, el peor contraste
  // del catálogo. Este da 3.93:1 —el mejor de las catorce— sin salirse del
  // acero: mismo matiz frío (219°) y misma saturación baja (15%), que es lo que
  // lo mantiene metálico y no un gris apagado. Sigue siendo MÁS CLARO que el
  // cuerpo, como en las otras trece, y con la misma separación que ellas.
  //
  // El degradado bajó con él. No es un cambio de diseño: conserva EXACTAMENTE
  // el mismo salto de luminosidad sobre la cabecera que tenía antes (+16), que
  // es lo que mantiene la ficha de la paleta y el nodo leyéndose como la misma
  // herramienta. Dejarlo en el claro anterior lo habría puesto a +34, fuera de
  // la banda en la que están las otras.
  colors: {
    header: "#748199",
    body: "#64748b",
    gradient: "linear-gradient(135deg,#a3aebd,#64748b)"
  },
  glyph: "🔀"
};
