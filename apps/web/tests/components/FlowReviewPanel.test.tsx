import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FlowReviewPanel } from "@features/automations/builder/components/review/FlowReviewPanel";
import type { FlowReview } from "@features/automations/builder/services/reviewFlow";

const clean: FlowReview = { issues: [], errorCount: 0, warningCount: 0 };

const withIssues: FlowReview = {
  issues: [
    { id: "incomplete-config:a", severity: "error", code: "incomplete-config", message: "«IA»: Elige una conexión de IA.", nodeId: "a" },
    { id: "incomplete-config:b", severity: "error", code: "incomplete-config", message: "«IA»: Elige una conexión de IA.", nodeId: "b" },
    { id: "broken-connection:e9", severity: "error", code: "broken-connection", message: "Hay una conexión hacia un bloque que ya no existe." },
    { id: "open-outputs:m", severity: "warning", code: "open-outputs", message: "«Menú» tiene salidas sin conectar (Otra respuesta).", nodeId: "m" },
    { id: "unreachable:s", severity: "warning", code: "unreachable", message: "«Suelto» está suelto.", nodeId: "s" }
  ],
  errorCount: 3,
  warningCount: 2
};

const open = () => fireEvent.click(screen.getByRole("button", { name: "Revisar flujo" }));

describe("FlowReviewPanel", () => {
  it("es un botón tranquilo: sin número ni color, haya o no algo que revisar", () => {
    const { rerender } = render(<FlowReviewPanel review={clean} onFocusNode={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: "Revisar flujo" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle.className).toBe("flow-review__toggle");

    rerender(<FlowReviewPanel review={withIssues} onFocusNode={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Revisar flujo" }).className).toBe("flow-review__toggle");
    expect(screen.queryByText(/por revisar|\d/)).not.toBeInTheDocument();
  });

  it("al abrirlo muestra solo lo que haría fallar el flujo, agrupado; las salidas sin conectar y los sueltos no", () => {
    render(<FlowReviewPanel review={withIssues} onFocusNode={vi.fn()} />);
    open();

    expect(screen.getByRole("region", { name: "Revisar flujo" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("· 2 bloques")).toBeInTheDocument();
    expect(screen.queryByText(/salidas sin conectar|suelto/)).not.toBeInTheDocument();
  });

  it("si el mismo problema está en varios bloques, cada toque lleva al siguiente", () => {
    const onFocusNode = vi.fn();
    render(<FlowReviewPanel review={withIssues} onFocusNode={onFocusNode} />);

    for (const expected of ["a", "b", "a"]) {
      open();
      fireEvent.click(screen.getByRole("button", { name: /Elige una conexión de IA/ }));
      expect(onFocusNode).toHaveBeenLastCalledWith(expected);
      expect(screen.queryByRole("region")).not.toBeInTheDocument();
    }
  });

  it("un problema sin bloque no se ofrece como enlace", () => {
    render(<FlowReviewPanel review={withIssues} onFocusNode={vi.fn()} />);
    open();

    expect(screen.queryByRole("button", { name: /ya no existe/ })).not.toBeInTheDocument();
    expect(screen.getByText(/ya no existe/)).toBeInTheDocument();
  });

  it("sin nada que haga fallar el flujo lo dice, aunque haya salidas sin conectar", () => {
    const soloAvisos: FlowReview = { issues: withIssues.issues.filter((issue) => issue.severity === "warning"), errorCount: 0, warningCount: 2 };
    render(<FlowReviewPanel review={soloAvisos} onFocusNode={vi.fn()} />);
    open();

    expect(screen.getByText("Nada que haga fallar el flujo")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("Escape cierra la tarjeta", () => {
    render(<FlowReviewPanel review={withIssues} onFocusNode={vi.fn()} />);
    open();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});
