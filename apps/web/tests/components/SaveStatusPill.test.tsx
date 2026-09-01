import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SaveStatusPill } from "../../src/features/automations/builder/components/builder-shell/SaveStatusPill";

// ---------------------------------------------------------------------------
// La cápsula presenta el estado real del autoguardado, sin inventar ninguno.
// Se valida qué comunica al usuario, no cómo está pintada.
// ---------------------------------------------------------------------------

describe("SaveStatusPill", () => {
  it("anuncia el guardado completado", () => {
    render(<SaveStatusPill status="saved" />);
    expect(screen.getByRole("status")).toHaveTextContent(/^Guardado$/);
  });

  it("anuncia que está guardando", () => {
    render(<SaveStatusPill status="saving" />);
    expect(screen.getByRole("status")).toHaveTextContent(/guardando/i);
  });

  it("anuncia el error de guardado en lugar de disfrazarlo de guardado", () => {
    render(<SaveStatusPill status="error" />);

    const pill = screen.getByRole("status");
    expect(pill).toHaveTextContent(/error al guardar/i);
    expect(pill).not.toHaveTextContent(/^Guardado$/);
  });

  it("un workspace recién cargado y sin editar se presenta como guardado", () => {
    render(<SaveStatusPill status="idle" />);
    expect(screen.getByRole("status")).toHaveTextContent(/guardado/i);
  });

  it("comunica estado y no acción: no es un botón", () => {
    render(<SaveStatusPill status="saved" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("status").tagName).toBe("SPAN");
  });
});
