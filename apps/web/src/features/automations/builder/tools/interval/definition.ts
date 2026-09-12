import { INTERVAL_DEFAULT_CONFIG } from "@contracts/IntervalConfig";
import type { ToolDefinition } from "../ToolDefinition";
import { summarizeInterval } from "./summarizeInterval";
import { validateInterval } from "./validateInterval";

/**
 * Programador — decide cuándo continúa la conversación.
 *
 * `executable: true`, y es honesto: `DelayNodeHandler` no finge nada —aparca la
 * sesión en `delayed` de verdad y `ExecutionLoop` lo respeta—. Lo que todavía
 * no existe es la COLA que la despierte, así que hoy una sesión que llega aquí
 * se queda esperando. Es el mismo estado de Fase C que ya tiene el vencimiento
 * de Esperar respuesta, y por eso esta bandera no cambia: lo que falta no es la
 * ejecución del nodo, es quien la reanude.
 *
 * QUEDA UN PASO DE RUNTIME PENDIENTE, y se deja anotado en vez de resuelto: el
 * handler lee hoy `config.resumeAt ?? config.delayMs`, dos campos que ninguna
 * versión del editor escribe. Cuando exista la cola, ese handler pasará a leer
 * el contrato con `readIntervalConfig`/`intervalWaitMs` —igual que
 * `QuestionNodeHandler` ya hace con el suyo— y no hará falta migrar ningún nodo
 * guardado. No se ha tocado aquí porque implementar runtime no es parte de este
 * trabajo, y escribir esos dos campos derivados desde el editor habría creado
 * una segunda fuente de verdad de la misma espera.
 *
 * NO DECLARA `duplicateConfig` NI `releaseResources`: su configuración son
 * datos planos sin identidades internas —la copia profunda genérica la
 * reproduce bien— y no reserva nada fuera de ella.
 */
export const intervalTool: ToolDefinition = {
  summarize: summarizeInterval,
  validateContent: validateInterval,
  type: "delay",
  // EL NOMBRE VISIBLE ES «Programador»; el tipo sigue siendo `delay` y el
  // módulo, `interval/`. Renombrar el tipo rompería los flujos guardados —es la
  // clave del nodo en el snapshot— y renombrar la carpeta sería mover cuarenta
  // importaciones para no cambiar nada de lo que el usuario ve. El rótulo es
  // pantalla; el tipo es dato, y solo uno de los dos tenía que cambiar.
  //
  // Corto a propósito: el nodo del lienzo mide 264px y «Programador de tiempo»
  // no cabe en su cabecera. Lo que hace lo explica la descripción.
  label: "Programador",
  description: "Define cuándo continuar",
  defaultContentText: "Continuar más tarde",
  editorTitle: "Programador",
  availableInPalette: true,
  terminal: false,
  executable: true,
  // La forma mínima válida la declara el contrato compartido, que es el mismo
  // que leerá el motor: así el nodo nace con exactamente lo que el handler
  // sabrá ejecutar, sin una segunda declaración que pueda divergir.
  defaultConfig: { ...INTERVAL_DEFAULT_CONFIG },
  // CYAN. Identidad ya aprobada por el producto: no se toca. El editor repite
  // estos dos tonos en `--iv-cyan` y `--iv-deep`.
  colors: {
    header: "#0891b2",
    body: "#0e7490",
    gradient: "linear-gradient(135deg,#22d3ee,#0e7490)"
  },
  glyph: "⏱"
};
