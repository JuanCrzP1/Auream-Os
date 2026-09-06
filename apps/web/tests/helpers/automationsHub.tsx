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

    // Renombrar una carpeta. La API falsa persiste de verdad, así que el
    // nombre que el hub muestra después sale de aquí.
    const renombrada = /\/automations\/folders\/([^/]+)$/.exec(String(url));
    if (method === "PATCH" && renombrada) {
      const { name } = JSON.parse(String(init?.body)) as { name: string };
      const i = folders.findIndex((f) => f.id === renombrada[1]);
      if (i >= 0) folders[i] = { ...folders[i]!, name };
      return { ok: true, status: 200, json: async () => ({ renamed: true }) } as unknown as Response;
    }

    // Mover una automatización de carpeta. La API falsa PERSISTE de verdad,
    // así que el estado que ve el hub tras recargar sale de aquí y no de un
    // atajo en el cliente.
    const movimiento = /\/automations\/([^/]+)\/folder$/.exec(String(url));
    if (method === "PATCH" && movimiento) {
      const { folderId } = JSON.parse(String(init?.body)) as { folderId: string | null };
      const i = flows.findIndex((f) => f.id === movimiento[1]);
      if (i >= 0) {
        const { folderId: _previo, ...resto } = flows[i]!;
        flows[i] = folderId === null ? resto : { ...resto, folderId };
      }
      return { ok: true, status: 204, json: async () => ({}) } as unknown as Response;
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

export function renderHub(entrada = "/automations") {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <AuthProvider>
        <ActiveTenantProvider>
          <Routes>
            <Route path="/automations" element={<AutomationsHubPage />} />
            {/* Una carpeta abierta es la MISMA pantalla, igual que en la
                aplicación: sin esta ruta las pruebas medirían otra cosa. */}
            <Route path="/automations/folders/:folderId" element={<AutomationsHubPage />} />
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
