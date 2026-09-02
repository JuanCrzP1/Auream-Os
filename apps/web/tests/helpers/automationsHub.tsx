import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../../src/shared/auth/context/AuthContext";
import { ActiveTenantProvider } from "../../src/shared/auth/tenant/ActiveTenantContext";
import { AutomationsHubPage } from "../../src/features/automations/list/pages/AutomationsHubPage";
import type {
  AutomationFolderSummary,
  AutomationSummary
} from "@contracts/AutomationContracts";

// ---------------------------------------------------------------------------
// Entorno compartido por los tests del hub de automatizaciones.
//
// Responsabilidad única: montar la página con sus proveedores y una API falsa
// con estado. No contiene aserciones: cada fichero de test decide qué probar.
// ---------------------------------------------------------------------------

export const FLOW: AutomationSummary = {
  id: "1",
  key: "k1",
  name: "Flujo de prueba",
  status: "active",
  updatedAt: "2024-01-01"
};

export const FOLDER: AutomationFolderSummary = { id: "f1", name: "Carpeta de prueba" };

/**
 * API falsa con estado: GET devuelve lo que hay, POST crea de verdad.
 *
 * Así el test recorre el mismo camino que producción —servicio, contrato y
 * recarga de la lista— en lugar de comprobar que un mock devolvió lo que el
 * propio test le puso.
 */
export function stubApi(seed: { flows?: AutomationSummary[]; folders?: AutomationFolderSummary[] } = {}) {
  const flows = [...(seed.flows ?? [])];
  const folders = [...(seed.folders ?? [])];

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";

    if (method === "POST" && String(url).includes("/automations/folders")) {
      const body = JSON.parse(String(init?.body)) as { name: string };
      const created: AutomationFolderSummary = { id: `f${folders.length + 1}`, name: body.name };
      folders.push(created);
      return { ok: true, status: 201, json: async () => created } as unknown as Response;
    }

    return { ok: true, status: 200, json: async () => ({ flows, folders }) } as unknown as Response;
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock };
}

/** Peticiones de creación de carpeta realmente enviadas. */
export function folderPostCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([url, init]) => {
    const method = (init as RequestInit | undefined)?.method;
    return method === "POST" && String(url).includes("/automations/folders");
  });
}

export function renderHub() {
  return render(
    <MemoryRouter initialEntries={["/automations"]}>
      <AuthProvider>
        <ActiveTenantProvider>
          <Routes>
            <Route path="/automations" element={<AutomationsHubPage />} />
            <Route path="/automations/templates" element={<div>Plantillas page</div>} />
            <Route path="/builder/:flowKey" element={<div>Builder page</div>} />
          </Routes>
        </ActiveTenantProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

/** Cabecera del hub: distingue la acción de arriba de las del centro. */
export function header(): HTMLElement {
  return screen.getByRole("banner");
}

export async function openFolderDialog() {
  await userEvent.click(screen.getByRole("button", { name: /nueva carpeta/i }));
  return screen.findByRole("dialog");
}

/** fetch por defecto: sin datos y sin sesión. */
export function stubEmptyApi() {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response));
}
