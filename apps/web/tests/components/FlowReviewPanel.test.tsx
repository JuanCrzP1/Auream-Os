import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FlowReviewPanel } from "@features/automations/builder/components/review/FlowReviewPanel";
import type { FlowReview } from "@features/automations/builder/services/reviewFlow";

const clean: FlowReview = { issues: [], errorCount: 0, warningCount: 0 };

const withIssues: FlowReview = {
  issues: [
    { id: "dead-end:a", severity: "error", code: "dead-end", message: "«Saludo» no continúa: conecta su salida al siguiente bloque.", nodeId: "a" },
    { id: "broken-connection:e9", severity: "error", code: "broken-connection", message: "Hay una conexión hacia un bloque que ya no existe." },
    { id: "unreachable:b", severity: "warning", code: "unreachable", message: "«Suelto» está suelto.", nodeId: "b" }
  ],
  errorCount: 2,
  warningCount: 1
};

describe("FlowReviewPanel", () => {
  it("con todo en orden lo dice sin abrir nada", () => {
    render(<FlowReviewPanel review={clean} onFocusNode={vi.fn()} />);

    const toggle = screen.getByRole("button", { name: /flujo en orden/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("resume cuántos puntos hay y cuántos son errores y avisos", () => {
    render(<FlowReviewPanel review={withIssues} onFocusNode={vi.fn()} />);

    expect(screen.getByRole("button", { name: /3 puntos por revisar/i })).toBeInTheDocument();
    expect(screen.getByLabelText("2 errores")).toHaveTextContent("2");
    expect(screen.getByLabelText("1 aviso")).toHaveTextContent("1");
  });

  it("al abrir lista los puntos; los que tienen bloque llevan a él y cierran", () => {
    const onFocusNode = vi.fn();
    render(<FlowReviewPanel review={withIssues} onFocusNode={onFocusNode} />);

    fireEvent.click(screen.getByRole("button", { name: /por revisar/i }));
    expect(screen.getByRole("region", { name: "Revisión del flujo" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: /«Saludo» no continúa/ }));
    expect(onFocusNode).toHaveBeenCalledWith("a");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("un punto sin bloque no se ofrece como enlace", () => {
    render(<FlowReviewPanel review={withIssues} onFocusNode={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /por revisar/i }));

    expect(screen.queryByRole("button", { name: /ya no existe/ })).not.toBeInTheDocument();
    expect(screen.getByText(/ya no existe/)).toBeInTheDocument();
  });

  it("Escape cierra la tarjeta", () => {
    render(<FlowReviewPanel review={withIssues} onFocusNode={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /por revisar/i }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("anuncia la gravedad de cada punto a los lectores de pantalla", () => {
    render(<FlowReviewPanel review={withIssues} onFocusNode={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /por revisar/i }));

    expect(screen.getAllByText("Error:")).toHaveLength(2);
    expect(screen.getAllByText("Aviso:")).toHaveLength(1);
  });
});
