import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  FLOW,
  FOLDER,
  header,
  renderHub,
  stubApi,
  stubEmptyApi
} from "../helpers/automationsHub";

// ---------------------------------------------------------------------------
// Regla de estado del hub: EMPTY vs POPULATED.
//
// hasContent = flows.length > 0 || folders.length > 0. Las acciones de
// creación existen en los dos estados, pero nunca en los dos sitios a la vez.
//
// La creación de carpeta se prueba en AutomationsHubFolders.test.tsx.
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.restoreAllMocks();
  stubEmptyApi();
});

describe("AutomationsHubPage", () => {
  // La carga inicial y la revalidación se prueban en AutomationsHubRefresh.

  it("describe el módulo bajo el título, en la cabecera", async () => {
    stubApi({ flows: [FLOW] });
    renderHub();
    await screen.findByText("Flujo de prueba");

    expect(
      within(header()).getByText("Crea y gestiona automatizaciones para simplificar tus procesos.")
    ).toBeInTheDocument();
  });

  it("muestra las tarjetas de flujo que devuelve el servidor", async () => {
    stubApi({ flows: [FLOW] });
    renderHub();
    expect(await screen.findByText("Flujo de prueba")).toBeInTheDocument();
  });
});

describe("AutomationsHubPage — estado vacío", () => {
  beforeEach(() => {
    stubApi();
  });

  it("muestra el empty state sin automatizaciones ni carpetas", async () => {
    renderHub();
    expect(await screen.findByText(/sin automatizaciones/i)).toBeInTheDocument();
  });

  it("ofrece Nueva automatización en el centro", async () => {
    renderHub();
    await screen.findByText(/sin automatizaciones/i);
    expect(header()).not.toContainElement(
      screen.getByRole("button", { name: /nueva automatización/i })
    );
  });

  it("ofrece Nueva carpeta en el centro", async () => {
    renderHub();
    await screen.findByText(/sin automatizaciones/i);
    expect(header()).not.toContainElement(
      screen.getByRole("button", { name: /nueva carpeta/i })
    );
  });

  it("ofrece Explorar plantillas en el centro", async () => {
    renderHub();
    await screen.findByText(/sin automatizaciones/i);
    expect(header()).not.toContainElement(
      screen.getByRole("button", { name: /explorar plantillas/i })
    );
  });

  it("NO muestra el botón Nueva en la cabecera", async () => {
    renderHub();
    await screen.findByText(/sin automatizaciones/i);
    expect(within(header()).queryAllByRole("button")).toHaveLength(0);
  });

  it("la acción central de crear lleva al builder", async () => {
    renderHub();
    await screen.findByText(/sin automatizaciones/i);
    await userEvent.click(screen.getByRole("button", { name: /nueva automatización/i }));
    expect(await screen.findByText("Builder page")).toBeInTheDocument();
  });

  it("Explorar plantillas lleva a su ruta, sin inventar plantillas", async () => {
    renderHub();
    await screen.findByText(/sin automatizaciones/i);
    await userEvent.click(screen.getByRole("button", { name: /explorar plantillas/i }));
    expect(await screen.findByText("Plantillas page")).toBeInTheDocument();
  });
});

describe("AutomationsHubPage — estado con contenido", () => {
  it("oculta el empty state cuando hay una automatización", async () => {
    stubApi({ flows: [FLOW] });
    renderHub();
    await screen.findByText("Flujo de prueba");
    expect(screen.queryByText(/sin automatizaciones/i)).not.toBeInTheDocument();
  });

  it("oculta el empty state cuando sólo hay una carpeta", async () => {
    stubApi({ folders: [FOLDER] });
    renderHub();
    await screen.findByText("Carpeta de prueba");
    expect(screen.queryByText(/sin automatizaciones/i)).not.toBeInTheDocument();
  });

  it("Nueva vive en la toolbar, junto a Nueva carpeta", async () => {
    // Las dos acciones de creación comparten la fila del buscador. Ni en la
    // cabecera, ni dentro de la rejilla de carpetas —esa es solo de carpetas—.
    stubApi({ flows: [FLOW] });
    renderHub();
    await screen.findByText("Flujo de prueba");

    const nueva = screen.getByRole("button", { name: /^nueva$/i });
    const carpeta = screen.getByRole("button", { name: /nueva carpeta/i });

    expect(header()).not.toContainElement(nueva);
    expect(nueva.closest(".hub-folder-grid")).toBeNull();
    // Hermanos en el mismo contenedor de acciones, y en este orden: primero la
    // acción principal del hub —crear una automatización— y después la de
    // ordenarlas en carpetas.
    expect(nueva.parentElement).toBe(carpeta.parentElement);
    expect(nueva.nextElementSibling).toBe(carpeta);
  });

  it("Nueva sigue llevando al builder", async () => {
    stubApi({ flows: [FLOW] });
    renderHub();
    await screen.findByText("Flujo de prueba");
    await userEvent.click(screen.getByRole("button", { name: /^nueva$/i }));
    expect(await screen.findByText("Builder page")).toBeInTheDocument();
  });

  it("no duplica acciones entre secciones", async () => {
    stubApi({ flows: [FLOW], folders: [FOLDER] });
    renderHub();
    await screen.findByText("Flujo de prueba");

    expect(screen.getAllByRole("button", { name: /^nueva$/i })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /nueva automatización/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /explorar plantillas/i })).not.toBeInTheDocument();
  });
});
