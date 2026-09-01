import { describe, expect, it } from "vitest";
import { listAllTools } from "../../apps/web/src/features/automations/builder/tools/registry.js";
import { validateKnownNodeTypes } from "../../domains/automations/validation/application/rules/validateKnownNodeTypes.js";
import type { FlowSnapshot, FlowNode, NodeType } from "../../contracts/FlowSnapshot.js";

// ---------------------------------------------------------------------------
// Contrato entre el catálogo de herramientas del builder y la validación del
// backend.
//
// Son dos declaraciones en dos capas distintas, y tienen que hablar del mismo
// conjunto de tipos:
//
//   frontend → tools/registry.ts        qué herramientas existen y se ofrecen
//   backend  → validateKnownNodeTypes   qué tipos acepta publicar el servidor
//
// Este test es lo que impide que se separen. Una herramienta añadida solo en el
// builder se publicaría y luego fallaría en ejecución con un tipo que el motor
// no sabe despachar; una retirada solo en el backend rompería el canvas.
// ---------------------------------------------------------------------------

function snapshotWithNodeType(type: string): FlowSnapshot {
  const node = {
    id: "n1",
    tenantId: "tenant-test",
    flowVersionId: "v1",
    type: type as NodeType,
    name: "n1",
    content: {},
    config: {},
    metadata: {}
  } satisfies FlowNode;

  return {
    flow: {
      id: "flow-1",
      tenantId: "tenant-test",
      key: "flow-1",
      name: "Flow",
      currentPublishedVersionId: null
    },
    version: {
      id: "v1",
      tenantId: "tenant-test",
      flowId: "flow-1",
      versionNumber: 1,
      status: "draft",
      entryNodeId: "n1"
    },
    nodes: { n1: node },
    edgesBySource: {}
  };
}

describe("paridad catálogo de herramientas ↔ validación del backend", () => {
  it("el backend acepta todos los tipos que el builder ofrece", () => {
    for (const tool of listAllTools()) {
      const issues = validateKnownNodeTypes(snapshotWithNodeType(tool.type));

      expect(issues, `el backend rechaza el tipo '${tool.type}' que el builder sí ofrece`).toEqual([]);
    }
  });

  it("rechaza un tipo que ninguna herramienta declara", () => {
    const issues = validateKnownNodeTypes(snapshotWithNodeType("capture"));

    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("UNKNOWN_NODE_TYPE");
    expect(issues[0]?.nodeId).toBe("n1");
  });

  it("rechaza los tipos retirados aunque estuvieran persistidos", () => {
    for (const retirado of ["capture", "action", "fallback"]) {
      const issues = validateKnownNodeTypes(snapshotWithNodeType(retirado));

      expect(issues.map((issue) => issue.code)).toEqual(["UNKNOWN_NODE_TYPE"]);
    }
  });
});
