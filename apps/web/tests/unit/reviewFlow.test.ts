import { describe, expect, it } from "vitest";
import { groupIssuesByNode, reviewFlow } from "@features/automations/builder/services/reviewFlow";
import type { CanvasEdge, CanvasNode } from "@features/automations/builder/types/canvas";

// ---------------------------------------------------------------------------
// Revisión del flujo: lo que el usuario ve en la esquina del lienzo. Las reglas
// del grafo las comparte con el backend (test de paridad en la raíz); aquí se
// fija lo propio del builder: configuración de cada bloque, salidas sin
// conectar, orden, ids y a qué bloque lleva cada punto.
// ---------------------------------------------------------------------------

function node(id: string, nodeType: string, config: Record<string, unknown> = {}, extra: Partial<CanvasNode["data"]> = {}): CanvasNode {
  return {
    id,
    type: "flowNode",
    position: { x: 0, y: 0 },
    data: {
      nodeType: nodeType as CanvasNode["data"]["nodeType"],
      title: id,
      preview: "",
      configSummary: "",
      isEntry: false,
      isTerminal: nodeType === "end",
      content: {},
      config,
      metadata: {},
      ...extra
    }
  };
}

function edge(id: string, source: string, target: string, sourceHandle?: string): CanvasEdge {
  return {
    id,
    source,
    target,
    ...(sourceHandle ? { sourceHandle } : {}),
    data: { priority: 10, isFallback: false, label: "", condition: { operator: "always" } }
  };
}

const start = () => node("Inicio", "start", {}, { isEntry: true });
const message = (id: string) => node(id, "message", { items: [{ id: "t", kind: "text", text: "Hola" }] });
const end = (id = "Fin") => node(id, "end");

const menu = (id: string) =>
  node(id, "menu", {
    format: "buttons",
    message: "¿Qué necesitas?",
    options: [
      { id: "o1", title: "Precios" },
      { id: "o2", title: "Horarios" }
    ]
  });

describe("reviewFlow", () => {
  it("un flujo completo y conectado no tiene nada que revisar", () => {
    const review = reviewFlow([start(), message("Saludo"), end()], [edge("e1", "Inicio", "Saludo"), edge("e2", "Saludo", "Fin")]);

    expect(review).toEqual({ issues: [], errorCount: 0, warningCount: 0 });
  });

  it("señala la configuración incompleta de un bloque y lleva a él", () => {
    const empty = node("Menú vacío", "menu");
    const review = reviewFlow([start(), empty, end()], [edge("e1", "Inicio", "Menú vacío"), edge("e2", "Menú vacío", "Fin", "menu-other")]);
    const issue = review.issues.find((candidate) => candidate.code === "incomplete-config");

    expect(issue).toMatchObject({ severity: "error", nodeId: "Menú vacío" });
    expect(issue?.message).toMatch(/^«Menú vacío»: /);
  });

  it("avisa de las salidas sin conectar, nombrándolas", () => {
    const review = reviewFlow([start(), menu("Menú"), end()], [edge("e1", "Inicio", "Menú"), edge("e2", "Menú", "Fin", "o1")]);
    const issue = review.issues.find((candidate) => candidate.code === "open-outputs");

    expect(issue).toMatchObject({ severity: "warning", nodeId: "Menú" });
    expect(issue?.message).toContain("Horarios");
    expect(issue?.message).toContain("Otra respuesta");
    expect(issue?.message).not.toContain("Precios");
  });

  it("un bloque sin ninguna salida conectada es un camino muerto, no una lista de salidas abiertas", () => {
    const review = reviewFlow([start(), menu("Menú")], [edge("e1", "Inicio", "Menú")]);
    const codes = review.issues.filter((issue) => issue.nodeId === "Menú").map((issue) => issue.code);

    expect(codes).toContain("dead-end");
    expect(codes).not.toContain("open-outputs");
  });

  it("ordena los errores antes que los avisos y los cuenta", () => {
    const review = reviewFlow(
      [start(), message("Saludo"), message("Suelto"), end()],
      [edge("e1", "Inicio", "Saludo"), edge("e2", "Saludo", "Fin"), edge("e3", "Suelto", "Fin"), edge("e4", "Fin", "fantasma")]
    );

    expect(review.errorCount).toBeGreaterThan(0);
    expect(review.warningCount).toBeGreaterThan(0);
    const firstWarning = review.issues.findIndex((issue) => issue.severity === "warning");
    expect(review.issues.slice(firstWarning).every((issue) => issue.severity === "warning")).toBe(true);
  });

  it("cada punto tiene un id único y estable", () => {
    const nodes = [start(), message("A"), message("B"), end()];
    const edges = [edge("e1", "Inicio", "A"), edge("x1", "A", "nada"), edge("x2", "B", "nada")];
    const first = reviewFlow(nodes, edges).issues.map((issue) => issue.id);

    expect(new Set(first).size).toBe(first.length);
    expect(reviewFlow(nodes, edges).issues.map((issue) => issue.id)).toEqual(first);
  });

  it("el inicio sin nada detrás es un camino muerto del inicio", () => {
    const review = reviewFlow([start()], []);
    expect(review.issues).toEqual([expect.objectContaining({ code: "dead-end", nodeId: "Inicio" })]);
  });
});

describe("groupIssuesByNode", () => {
  it("agrupa por bloque con la peor gravedad y los motivos, errores primero", () => {
    const empty = node("Etiquetas", "tags");
    const byNode = groupIssuesByNode(reviewFlow([start(), message("Saludo"), empty, end()], [edge("e1", "Inicio", "Saludo"), edge("e2", "Saludo", "Fin")]));
    const tags = byNode.get("Etiquetas");

    expect(tags?.severity).toBe("error");
    expect(tags?.messages.length).toBeGreaterThanOrEqual(2);
    expect(tags?.messages.at(-1)).toMatch(/suelto/);
  });

  it("un bloque solo con avisos queda en aviso; los sanos no aparecen", () => {
    const byNode = groupIssuesByNode(reviewFlow([start(), menu("Menú"), end()], [edge("e1", "Inicio", "Menú"), edge("e2", "Menú", "Fin", "o1")]));

    expect(byNode.get("Menú")?.severity).toBe("warning");
    expect(byNode.has("Inicio")).toBe(false);
    expect(byNode.has("Fin")).toBe(false);
  });
});
