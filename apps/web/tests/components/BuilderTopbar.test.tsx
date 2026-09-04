import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BuilderPage } from "../../src/features/automations/builder/pages/BuilderPage";

// ---------------------------------------------------------------------------
// Composición de la topbar del builder.
//
// Se mockean las fronteras que no se están probando —lienzo, paleta, shell y el
// hook del workspace— para que el test hable sólo de qué controles ve el
// usuario en la topbar. No valida markup ni clases.
//
// El modelo del builder es editar → autoguardar. La topbar no lleva publicar,
// ni versión, ni rollback: el versionado se construirá con la persistencia
// real. Estos tests fijan esa composición.
// ---------------------------------------------------------------------------

vi.mock("../../src/features/automations/builder/components/builder-shell/BuilderShell", () => ({
  BuilderShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock("../../src/features/automations/builder/components/canvas/BuilderCanvas", () => ({
  BuilderCanvas: () => <div data-testid="canvas" />
}));

vi.mock("../../src/features/automations/builder/components/panels/PalettePanel", () => ({
  PalettePanel: () => <aside data-testid="palette" />
}));

const handleRenameFlow = vi.fn();
const handleRollback = vi.fn();

vi.mock("../../src/features/automations/builder/hooks/useBuilderWorkspace", () => ({
  useBuilderWorkspace: () => ({
    loading: false,
    error: null,
    flowName: "Nueva automatización",
    versionLabel: "v1",
    autosaveStatus: "saved",
    nodes: [],
    edges: [],
    handleRenameFlow,
    handleRollback,
    handlePublish: vi.fn(),
    handleNodesChange: vi.fn(),
    handleEdgesChange: vi.fn(),
    handleConnect: vi.fn(),
    handleSelectNode: vi.fn(),
    handleSelectEdge: vi.fn(),
    handleAddNode: vi.fn(),
    handleDropNode: vi.fn(),
    handleUpdateNode: vi.fn(),
    simulationLog: [],
    simulationStatus: "idle",
    handleSimulate: vi.fn(),
    resetSimulation: vi.fn(),
    stats: {},
    validation: { errors: [], warnings: [] },
    selectedNode: null,
    selectedEdge: null
  })
}));

// La página lee `flowKey` de la ruta; se inyecta sin montar el router de la app.
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useParams: () => ({ flowKey: "flow-1" }) };
});

function renderTopbar() {
  render(
    <MemoryRouter initialEntries={["/builder/flow-1"]}>
      <BuilderPage />
    </MemoryRouter>
  );
}

describe("topbar del builder", () => {
  it("NO ofrece publicar: el modelo es autoguardado, no editar → publicar", () => {
    renderTopbar();
    expect(screen.queryByRole("button", { name: /publicar/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/publicar/i)).not.toBeInTheDocument();
  });

  it("NO ofrece rollback: el historial llegará con la persistencia real", () => {
    renderTopbar();
    expect(screen.queryByRole("button", { name: /rollback/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/rollback/i)).not.toBeInTheDocument();
  });

  it("NO muestra la etiqueta de versión", () => {
    renderTopbar();
    expect(screen.queryByText(/^v\d+$/)).not.toBeInTheDocument();
  });

  it("comunica el estado de guardado", () => {
    renderTopbar();
    const pill = screen.getByRole("status");

    expect(pill).toHaveTextContent(/guardado/i);
  });

  it("el estado de guardado no es un control accionable", () => {
    renderTopbar();
    expect(screen.getByRole("status").tagName).not.toBe("BUTTON");
  });

  it("ofrece volver a automatizaciones", () => {
    renderTopbar();
    expect(screen.getByRole("button", { name: /volver a automatizaciones/i })).toBeInTheDocument();
  });

  it("muestra el nombre y su control de edición en estado normal, sin hover", () => {
    renderTopbar();
    expect(screen.getByText("Nueva automatización")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /editar nombre de automatización/i })
    ).toBeInTheDocument();
  });
});
