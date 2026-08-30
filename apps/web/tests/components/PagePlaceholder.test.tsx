import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PagePlaceholder } from "../../src/shared/ui/page-placeholder/PagePlaceholder";
import { AiAgentsPage } from "../../src/features/ai-agents/pages/AiAgentsPage";
import { ConnectionsPage } from "../../src/features/connections/pages/ConnectionsPage";
import { TemplatesPage } from "../../src/app/router/placeholders/TemplatesPage";
import { ArchivePage } from "../../src/app/router/placeholders/ArchivePage";

// ---------------------------------------------------------------------------
// El marcador de módulo pendiente sustituyó cuatro copias del mismo bloque.
// Estos casos fijan que las cuatro pantallas siguen anunciándose y que todas
// pasan por la misma pieza, para que la quinta no vuelva a duplicarla.
// ---------------------------------------------------------------------------

describe("PagePlaceholder", () => {
  it("presenta el título como encabezado de la página", () => {
    render(<PagePlaceholder title="Dashboard" description="Resumen de tu operación." />);

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("muestra la descripción del módulo", () => {
    render(<PagePlaceholder title="Dashboard" description="Resumen de tu operación." />);

    expect(screen.getByText("Resumen de tu operación.")).toBeInTheDocument();
  });

  it("indica que el módulo todavía no está disponible", () => {
    render(<PagePlaceholder title="Dashboard" description="Resumen." />);

    expect(screen.getByText(/próximamente/i)).toBeInTheDocument();
  });
});

describe("pantallas pendientes", () => {
  it.each([
    ["AI Agents", <AiAgentsPage key="a" />],
    ["Conexiones", <ConnectionsPage key="c" />],
    ["Plantillas", <TemplatesPage key="t" />],
    ["Archivo", <ArchivePage key="r" />]
  ])("%s se anuncia como pendiente", (title, element) => {
    render(element);

    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText(/próximamente/i)).toBeInTheDocument();
  });
});
