import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PagePlaceholder } from "../../src/shared/ui/page-placeholder/PagePlaceholder";
import { AiAgentsPage } from "../../src/features/ai-agents/pages/AiAgentsPage";
import { DashboardPage } from "../../src/features/dashboard/pages/DashboardPage";
import { BroadcastsPage } from "../../src/features/broadcasts/pages/BroadcastsPage";
import { GroupsPage } from "../../src/features/groups/pages/GroupsPage";
import { MetaAdsPage } from "../../src/features/ads/pages/MetaAdsPage";
import { SalesPage } from "../../src/features/sales/pages/SalesPage";
import { TemplatesPage } from "../../src/app/router/placeholders/TemplatesPage";
import { ArchivePage } from "../../src/app/router/placeholders/ArchivePage";

// ---------------------------------------------------------------------------
// El marcador de módulo pendiente sustituyó cuatro copias del mismo bloque.
// Estos casos fijan que las pantallas pendientes siguen anunciándose y que
// todas pasan por la misma pieza (Conexiones ya es una pantalla real).
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
    ["Agentes de IA", <AiAgentsPage key="a" />],
    ["Dashboard", <DashboardPage key="d" />],
    ["Difusiones", <BroadcastsPage key="b" />],
    ["Grupos y comunidades", <GroupsPage key="g" />],
    ["Meta Ads", <MetaAdsPage key="m" />],
    ["Ventas", <SalesPage key="s" />],
    ["Plantillas", <TemplatesPage key="t" />],
    ["Archivo", <ArchivePage key="r" />]
  ])("%s se anuncia como pendiente", (title, element) => {
    render(element);

    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText(/próximamente/i)).toBeInTheDocument();
  });
});
