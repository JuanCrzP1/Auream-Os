import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FLOW, openFolderDialog, renderHub, stubApi, stubEmptyApi } from "../helpers/automationsHub";

// ---------------------------------------------------------------------------
// Revalidación de la lista tras una mutación.
//
// La carga inicial puede vaciar la pantalla; una revalidación NO. Crear una
// carpeta recarga la lista, y mientras tanto el hub debe seguir en pie: sin
// "Cargando automatizaciones...", sin desmontar las tarjetas.
// ---------------------------------------------------------------------------

/** Primer GET correcto; los siguientes fallan. Sirve para probar el fallo de revalidación. */
function stubApiWithFailingRefresh(seed: { flows: typeof FLOW[] }) {
  let getCalls = 0;

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";

    if (method === "POST" && String(url).includes("/automations/folders")) {
      return {
        ok: true,
        status: 201,
        json: async () => ({ id: "f1", name: "Ventas" })
      } as unknown as Response;
    }

    // Sólo cuentan los GET del listado: los proveedores hacen los suyos.
    if (!String(url).includes("/automations")) {
      return { ok: true, status: 200, json: async () => null } as unknown as Response;
    }

    getCalls += 1;
    if (getCalls === 1) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ flows: seed.flows, folders: [] })
      } as unknown as Response;
    }

    return { ok: false, status: 500, text: async () => "Error 500" } as unknown as Response;
  });

  vi.stubGlobal("fetch", fetchMock);
}

async function createFolderFromToolbar(name: string) {
  await openFolderDialog();
  await userEvent.type(screen.getByLabelText("Nombre de la carpeta"), `${name}{Enter}`);
}

beforeEach(() => {
  vi.restoreAllMocks();
  stubEmptyApi();
});

describe("AutomationsHubPage — carga inicial vs revalidación", () => {
  it("la carga inicial sí muestra el estado de carga", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    renderHub();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it("la revalidación NO muestra 'Cargando automatizaciones...' ni desmonta la lista", async () => {
    stubApi({ flows: [FLOW] });
    renderHub();
    await screen.findByText("Flujo de prueba");

    await createFolderFromToolbar("Ventas");

    // En el instante siguiente a la mutación la lista sigue montada.
    expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
    expect(screen.getByText("Flujo de prueba")).toBeInTheDocument();

    expect(await screen.findByText("Ventas")).toBeInTheDocument();
    expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
  });

  it("la revalidación correcta actualiza los datos", async () => {
    stubApi({ flows: [FLOW] });
    renderHub();
    await screen.findByText("Flujo de prueba");

    await createFolderFromToolbar("Ventas");

    expect(await screen.findByText("Ventas")).toBeInTheDocument();
    expect(screen.getByText("Flujo de prueba")).toBeInTheDocument();
  });

  it("una revalidación fallida conserva los datos anteriores y avisa", async () => {
    stubApiWithFailingRefresh({ flows: [FLOW] });
    renderHub();
    await screen.findByText("Flujo de prueba");

    await createFolderFromToolbar("Ventas");

    expect(await screen.findByRole("status")).toHaveTextContent(/últimos datos disponibles/i);
    expect(screen.getByText("Flujo de prueba")).toBeInTheDocument();
    expect(screen.queryByText(/sin automatizaciones/i)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument());
  });
});
