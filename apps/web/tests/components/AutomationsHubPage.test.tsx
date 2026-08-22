import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AutomationsHubPage } from "../../src/features/automations/list/pages/AutomationsHubPage";

function renderHub() {
  return render(
    <MemoryRouter initialEntries={["/automations"]}>
      <Routes>
        <Route path="/automations" element={<AutomationsHubPage />} />
        <Route path="/builder/:flowKey" element={<div>Builder page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response));
});

describe("AutomationsHubPage", () => {
  it("shows loading state initially", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    renderHub();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it("shows empty state when no automations", async () => {
    renderHub();
    await waitFor(() => {
      expect(screen.getByText(/sin automatizaciones/i)).toBeInTheDocument();
    });
  });

  it("shows header with Nueva button", async () => {
    renderHub();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /nueva/i })).toBeInTheDocument();
    });
  });

  it("navigates to builder when Nueva is clicked", async () => {
    renderHub();
    await waitFor(() => screen.getByText(/sin automatizaciones/i));
    await userEvent.click(screen.getAllByRole("button", { name: /nueva/i })[0]);
    await waitFor(() => {
      expect(screen.getByText("Builder page")).toBeInTheDocument();
    });
  });

  it("shows flow cards when server returns flows", async () => {
    const mockData = {
      flows: [{ id: "1", key: "k1", name: "Flujo de prueba", status: "active", updatedAt: "2024-01-01" }],
      folders: []
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData
    } as unknown as Response));
    renderHub();
    await waitFor(() => {
      expect(screen.getByText("Flujo de prueba")).toBeInTheDocument();
    });
  });
});
