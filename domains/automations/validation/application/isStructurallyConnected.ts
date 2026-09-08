import type { FlowSnapshot } from "../../../../contracts/FlowSnapshot";
import { validateEmptyFlow } from "./rules/validateEmptyFlow";
import { validateEntryNode } from "./rules/validateEntryNode";
import { validateEdgeIntegrity } from "./rules/validateEdgeIntegrity";
import { detectUnreachable } from "./rules/detectUnreachable";

// ---------------------------------------------------------------------------
// isStructurallyConnected
//
// Responde UNA sola pregunta: ¿los nodos que hay dibujados forman una sola
// pieza colgando del Inicio?
//
// NO responde «¿puede publicarse?». Esa es la pregunta de `GraphValidator`, y
// confundirlas fue el defecto real que corrige este módulo: el Hub pintaba en
// rojo un `Inicio → Etiquetas` perfectamente conectado porque el validador de
// publicación exige que toda rama termine en un nodo `end` —`validateNodeDegree`—
// y `end` ni siquiera se ofrece en la paleta. El usuario veía dos nodos unidos
// por una flecha y un punto rojo diciéndole lo contrario.
//
// Se compone de las reglas que ya existen; no se reimplementa ninguna. Las
// cuatro que se usan son exactamente las que hablan de topología:
//
//   validateEmptyFlow     sin nodos no hay estructura que conectar
//   validateEntryNode     sin un Inicio válido no hay desde dónde recorrer
//   validateEdgeIntegrity una flecha rota no une nada
//   detectUnreachable     lo que no se alcanza desde Inicio está suelto
//
// Y las que se dejan fuera, deliberadamente, porque hablan de si el flujo está
// TERMINADO o si el motor podrá ejecutarlo —no de si está conectado—:
//
//   validateNodeDegree      exige rama terminada en `end`
//   validateFallbacks       exige salida por defecto en las preguntas
//   validateEdgePriorities  exige desempate determinista entre flechas
//   detectCycles            exige que el flujo pueda terminar
//   validateKnownNodeTypes  exige que el motor sepa ejecutar cada tipo
//
// UN ÚNICO NODO «Inicio» SIN SALIDA SE CONSIDERA CONECTADO. Es la respuesta
// coherente con la pregunta: hay Inicio, no hay ningún nodo suelto y no hay
// ninguna flecha rota, luego no hay nada desconectado. Que ese flujo todavía no
// sirva para publicar es cierto y es asunto del validador, no de este punto.
// ---------------------------------------------------------------------------

export function isStructurallyConnected(snapshot: FlowSnapshot): boolean {
  const nodeIds = new Set(Object.keys(snapshot.nodes));

  if (validateEmptyFlow(snapshot).length > 0) return false;
  if (validateEntryNode(snapshot, nodeIds).length > 0) return false;
  if (validateEdgeIntegrity(snapshot, nodeIds).length > 0) return false;

  // El Inicio ya está comprobado: existe y apunta a un nodo real.
  return detectUnreachable(snapshot, snapshot.version.entryNodeId, nodeIds).length === 0;
}
