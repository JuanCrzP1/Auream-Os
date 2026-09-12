import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { ExpandedNodeOverlay } from "@features/automations/builder/components/canvas/ExpandedNodeOverlay";
import { BuilderEditingProvider } from "@features/automations/builder/context/BuilderEditingContext";
import { useCanvasNodes } from "@features/automations/builder/hooks/canvas/useCanvasNodes";
import { createNodeDraft } from "@features/automations/builder/services/createNodeDraft";
import { applyNodePatch } from "@features/automations/builder/services/applyNodePatch";
import { summarizeInterval } from "@features/automations/builder/tools/interval/summarizeInterval";
import type { CanvasNode } from "@features/automations/builder/types/canvas";

// LAS DOS HOJAS GLOBALES, en el mismo orden que `main.tsx`.
//
// `theme.css` trae las PALETAS —`--text`, `--border`, `--surface`…— y sin ella
// el banco se pintaba con los valores iniciales del navegador: los campos sin
// fondo ni borde y el texto en negro sobre oscuro.
import "@shared/styles/theme.css";
import "@shared/styles/index.css";
import "@xyflow/react/dist/style.css";

// ---------------------------------------------------------------------------
// Banco de pruebas del navegador: el Programador REAL, por el CAMINO REAL.
//
// QUÉ CAMBIÓ AQUÍ, Y POR QUÉ IMPORTA MÁS QUE NINGUNA OTRA COSA DE ESTE ARCHIVO.
//
// Este banco montaba `NodeExpandedFrame` A MANO, con un `useState` propio
// sosteniendo el nodo. Parecía fiel —usaba el marco de verdad— pero NO lo era
// en el único eje donde vivía el fallo que perseguíamos: quién le entrega el
// nodo al marco y cuándo cambia ese objeto.
//
//   · A mano, el nodo solo cambiaba al confirmar. Identidad estable, cero
//     resincronizaciones, cero divergencias posibles.
//   · De verdad, el nodo vive en el store de React Flow. `useNodes()` devuelve
//     objetos NUEVOS ante cualquier cambio del lienzo —selección, arrastre,
//     medición—, y `NodeExpandedFrame` tiene que decidir en cada uno si lo que
//     el usuario lleva escrito sigue valiendo.
//
// Esa diferencia es EXACTAMENTE la clase de fallo que se reportó: fecha visible
// en pantalla y borrador que ya no la tiene. Un banco que no monta el lienzo no
// puede reproducirla, y por eso la prueba de navegador daba verde mientras el
// producto fallaba. Se estaba validando un clon simplificado.
//
// AHORA SE MONTA LA CADENA ENTERA, la misma que `BuilderPage`:
//
//     ReactFlowProvider
//       └ ReactFlow            ← el store real; `useNodes()` lee de aquí
//       └ BuilderEditingProvider
//           └ ExpandedNodeOverlay   ← decide qué nodo está abierto
//               └ NodeExpandedFrame ← el marco, con Guardar y Cancelar
//                   └ IntervalEditor
//
// y las operaciones son las de `useCanvasNodes`, no unas escritas para la
// prueba: `updateNode` es el mismo mutador del producto y `toggleNodeExpanded`
// el mismo gesto de abrir y cerrar.
//
// LO ÚNICO QUE NO ESTÁ es lo que no toca a esta herramienta: enrutado, sesión,
// API y autoguardado. Nada de eso participa en configurar un nodo.
//
// Nace con una fecha y una hora YA GUARDADAS, en la forma de la versión
// ANTERIOR (`mode: "date"`), porque esa es la situación que se rompió: un nodo
// configurado al que se le cambia solo la hora.
// ---------------------------------------------------------------------------

const GUARDADO_INICIAL = {
  mode: "date",
  wait: { amount: 5, unit: "minutes" },
  moment: { date: "2026-09-12", time: "12:30" },
  schedule: {}
};

/** El nodo de partida, construido por el mismo camino que el producto. */
const nodoInicial = (): CanvasNode =>
  applyNodePatch(
    { ...createNodeDraft("delay", 0), data: { ...createNodeDraft("delay", 0).data, isExpanded: true } },
    { config: GUARDADO_INICIAL }
  );

/** Un Programador RECIÉN CREADO, sin nada configurado y ya abierto. */
const nodoNuevo = (): CanvasNode => {
  const base = createNodeDraft("delay", 0);
  return { ...base, data: { ...base.data, isExpanded: true } };
};

function Banco() {
  const [inicial] = useState(() => [nodoInicial()]);
  // `generacion` reinicia el lienzo entero, que es lo más parecido a crear un
  // nodo nuevo sin montar la paleta del Builder.
  const [generacion, setGeneracion] = useState(0);

  return (
    <Lienzo
      key={generacion}
      inicial={generacion === 0 ? inicial : [nodoNuevo()]}
      onNuevo={() => setGeneracion((g) => g + 1)}
    />
  );
}

function Lienzo({
  inicial,
  onNuevo
}: {
  readonly inicial: CanvasNode[];
  readonly onNuevo: () => void;
}) {
  const canvas = useCanvasNodes(inicial, null);

  return (
    <BuilderEditingProvider
      requestEdit={() => {}}
      toggleExpand={canvas.toggleNodeExpanded}
      updateNode={canvas.updateNode}
      duplicateNode={() => {}}
      removeNode={() => {}}
    >
      {/* EL LIENZO DE VERDAD. Sostiene el store del que `ExpandedNodeOverlay`
          lee con `useNodes()`, que es la frontera donde vivía el fallo. */}
      <div style={{ width: "100%", height: 620 }}>
        <ReactFlow
          nodes={canvas.nodes}
          edges={[]}
          onNodesChange={canvas.handleNodesChange}
          nodesDraggable={false}
          fitView
        />
      </div>

      <ExpandedNodeOverlay />

      {/* Espejo de lo GUARDADO en el nodo, no de lo escrito en el editor. */}
      <pre id="guardado">{summarizeInterval({}, canvas.nodes[0]?.data.config ?? {})}</pre>

      {/* La configuración REAL, tal cual iría al disco. Es lo único que prueba
          que la pantalla hable en doce horas sin que el contrato se mueva. */}
      <pre id="config-cruda">{JSON.stringify(canvas.nodes[0]?.data.config ?? {})}</pre>

      {/* Reabrir es el MISMO gesto del producto: `toggleExpand` sobre el nodo,
          no un `useState` de la prueba. */}
      <button id="reabrir" type="button" onClick={() => canvas.toggleNodeExpanded(canvas.nodes[0].id)}>
        reabrir
      </button>

      {/* Un Programador recién creado, para poder recorrer el caso de cero. */}
      <button id="nuevo" type="button" onClick={onNuevo}>
        nuevo
      </button>
    </BuilderEditingProvider>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <ReactFlowProvider>
    <Banco />
  </ReactFlowProvider>
);

// SEÑAL DE «YA ESTOY», para que los runners no dependan de un reloj. El lienzo
// real de React Flow tarda más en montar que el marco suelto que había antes, y
// esperar «lo bastante» es justo como se cuelan los rojos que no son del
// producto.
requestAnimationFrame(() => {
  requestAnimationFrame(() => document.documentElement.setAttribute("data-banco", "listo"));
});
