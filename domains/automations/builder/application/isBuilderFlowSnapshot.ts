import type { BuilderFlowSnapshot } from "../../../../contracts/FlowSnapshot";

// ---------------------------------------------------------------------------
// ¿Tiene esto la forma de un borrador de flujo? Comprobación de FRONTERA para
// lo que llega por HTTP (FASE C4). No valida reglas del grafo (eso es
// `GraphValidator`): solo que la estructura sea la que el sistema sabe leer.
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === "string";

function isNode(value: unknown): boolean {
  return (
    isRecord(value) &&
    isText(value["id"]) &&
    isText(value["type"]) &&
    isText(value["name"]) &&
    isRecord(value["content"]) &&
    isRecord(value["config"]) &&
    isRecord(value["metadata"])
  );
}

function isEdge(value: unknown): boolean {
  return (
    isRecord(value) &&
    isText(value["id"]) &&
    isText(value["fromNodeId"]) &&
    isText(value["toNodeId"]) &&
    typeof value["priority"] === "number" &&
    typeof value["isFallback"] === "boolean" &&
    isRecord(value["condition"])
  );
}

export function isBuilderFlowSnapshot(value: unknown): value is BuilderFlowSnapshot {
  if (!isRecord(value) || !isRecord(value["flow"]) || !isRecord(value["version"])) return false;
  const { flow, version, nodes, edgesBySource } = value as Record<string, Record<string, unknown>>;

  return (
    isText(flow["id"]) &&
    isText(flow["key"]) &&
    isText(flow["name"]) &&
    isText(version["id"]) &&
    typeof version["versionNumber"] === "number" &&
    isText(version["entryNodeId"]) &&
    isRecord(nodes) &&
    Object.values(nodes).every(isNode) &&
    isRecord(edgesBySource) &&
    Object.values(edgesBySource).every((edges) => Array.isArray(edges) && edges.every(isEdge))
  );
}
