import { describe, expect, it } from "vitest";
import { checkConnection, findOvercrowdedOutputs } from "@features/automations/builder/services/connectionRules";
import { createNodeDraft } from "@features/automations/builder/services/createNodeDraft";
import { applyNodePatch } from "@features/automations/builder/services/applyNodePatch";
import type { CanvasEdge, CanvasNode } from "@features/automations/builder/types/canvas";
import type { NodeType } from "@contracts/FlowSnapshot";

function node(id: string, type: NodeType, config?: Record<string, unknown>, isEntry = false): CanvasNode {
  const base = createNodeDraft(type, 0);
  const patched = config ? applyNodePatch(base, { config: { ...base.data.config, ...config } }) : base;
  return { ...patched, id, data: { ...patched.data, isEntry } };
}

function edge(source: string, target: string, sourceHandle?: string): CanvasEdge {
  return { id: `${source}-${target}-${sourceHandle ?? ""}`, source, target, ...(sourceHandle ? { sourceHandle } : {}) };
}

const NODES = [
  node("start", "message", undefined, true),
  node("msg", "message"),
  node("wait", "question", { waitIndefinitely: false, timeout: { amount: 30, unit: "minutes" } }),
  node("split", "distributor", { outputs: [{ id: "a", label: "A" }, { id: "b", label: "B" }] }),
  node("end1", "tags"),
  node("end2", "pixel")
];

describe("reglas al conectar", () => {
  it("permite conectar una salida libre con otro bloque", () => {
    expect(checkConnection(NODES, [], { source: "msg", target: "end1" })).toEqual({ ok: true });
  });

  it("una salida única admite una sola conexión", () => {
    const result = checkConnection(NODES, [edge("msg", "end1")], { source: "msg", target: "end2" });
    expect(result).toMatchObject({ ok: false, reason: "output-taken" });
  });

  it("el bloque de inicio también tiene una sola salida", () => {
    const result = checkConnection(NODES, [edge("start", "msg")], { source: "start", target: "wait" });
    expect(result).toMatchObject({ ok: false, reason: "output-taken" });
  });

  it("cada salida con nombre admite una conexión, independiente de las demás", () => {
    const edges = [edge("wait", "end1", "respuesta")];
    expect(checkConnection(NODES, edges, { source: "wait", target: "end2", sourceHandle: "tiempo-agotado" }).ok).toBe(true);
    expect(checkConnection(NODES, edges, { source: "wait", target: "end2", sourceHandle: "respuesta" })).toMatchObject({
      ok: false,
      reason: "output-taken"
    });
  });

  it("un bloque no se conecta consigo mismo", () => {
    expect(checkConnection(NODES, [], { source: "msg", target: "msg" })).toMatchObject({ ok: false, reason: "self" });
  });

  it("al inicio no llega ninguna conexión", () => {
    expect(checkConnection(NODES, [], { source: "msg", target: "start" })).toMatchObject({ ok: false, reason: "into-entry" });
  });

  it("rechaza una salida que la configuración ya no ofrece", () => {
    expect(checkConnection(NODES, [], { source: "split", target: "end1", sourceHandle: "c" })).toMatchObject({
      ok: false,
      reason: "invalid-output"
    });
  });

  it("varias conexiones pueden llegar al mismo bloque", () => {
    const edges = [edge("msg", "end1")];
    expect(checkConnection(NODES, edges, { source: "split", target: "end1", sourceHandle: "a" }).ok).toBe(true);
  });

  it("explica cada rechazo con un mensaje para el usuario", () => {
    const result = checkConnection(NODES, [edge("msg", "end1")], { source: "msg", target: "end2" });
    expect(result.ok ? "" : result.message).toMatch(/ya está conectada/);
  });
});

describe("salidas con más de una conexión en un grafo existente", () => {
  it("detecta el bloque afectado y no confunde salidas distintas", () => {
    const edges = [edge("msg", "end1"), edge("msg", "end2"), edge("wait", "end1", "respuesta"), edge("wait", "end2", "tiempo-agotado")];
    expect(findOvercrowdedOutputs(edges)).toEqual(["msg"]);
  });
});
