import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FLOW, renderHub, stubApi, stubEmptyApi } from "../helpers/automationsHub";
import type { AutomationFolderSummary } from "@contracts/AutomationContracts";

// ---------------------------------------------------------------------------
// EL MENÚ DE UNA CARPETA.
//
// Mismo lenguaje que el de una automatización: los tres puntos, el menú
// contextual genérico y el diálogo de renombrar que ya existían. Lo único
// nuevo es qué acciones ofrece una carpeta.
//
// Se recorre la cadena real contra la API falsa, que persiste: el nombre que
// el hub muestra después de renombrar viene de la lista recargada, no de un
// estado local.
// ---------------------------------------------------------------------------

const VENTAS: AutomationFolderSummary = { id: "c1", name: "Ventas" };
const SOPORTE: AutomationFolderSummary = { id: "c2", name: "Soporte" };

const menuDe = (nombre: string) =>
  screen.getByRole("button", { name: `Acciones para ${nombre}` });
const carpetaCard = (nombre: string) =>
  screen.getByText(nombre).closest(".hub-folder-card") as HTMLElement;

beforeEach(() => {
  vi.restoreAllMocks();
  stubEmptyApi();
});

describe("cada carpeta tiene su menú de acciones", () => {
  it("muestra los tres puntos en cada carpeta", async () => {
    stubApi({ flows: [FLOW], folders: [VENTAS, SOPORTE] });
    renderHub();
    await screen.findByText("Ventas");

    expect(menuDe("Ventas")).toBeInTheDocument();
    expect(menuDe("Soporte")).toBeInTheDocument();
  });

  it("al pulsarlo se abre el menú con Renombrar y Personalizar, y nada más", async () => {
    stubApi({ flows: [FLOW], folders: [VENTAS] });
    renderHub();
    await screen.findByText("Ventas");

    await userEvent.click(menuDe("Ventas"));

    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Renombrar")).toBeInTheDocument();
    expect(within(menu).getByText("Personalizar")).toBeInTheDocument();
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(2);
  });

  it("pulsar los tres puntos NO abre la carpeta", async () => {
    stubApi({ flows: [FLOW], folders: [VENTAS] });
    renderHub();
    await screen.findByText("Ventas");

    await userEvent.click(menuDe("Ventas"));

    // Seguimos en la raíz: si hubiera navegado, la automatización suelta ya no
    // se vería y aparecerían las migas.
    expect(screen.getByText(FLOW.name)).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Ubicación" })).not.toBeInTheDocument();
  });

  it("pulsar la tarjeta fuera del menú sí abre la carpeta", async () => {
    stubApi({ flows: [FLOW], folders: [VENTAS] });
    renderHub();
    await screen.findByText("Ventas");

    await userEvent.click(carpetaCard("Ventas"));

    expect(await screen.findByRole("navigation", { name: "Ubicación" })).toHaveTextContent("Ventas");
  });
});

describe("Renombrar cambia el nombre de la carpeta", () => {
  it("abre el diálogo con el nombre actual y lo guarda", async () => {
    stubApi({ flows: [FLOW], folders: [VENTAS] });
    renderHub();
    await screen.findByText("Ventas");

    await userEvent.click(menuDe("Ventas"));
    await userEvent.click(screen.getByText("Renombrar"));

    const campo = await screen.findByDisplayValue("Ventas");
    await userEvent.clear(campo);
    await userEvent.type(campo, "Clientes VIP{Enter}");

    // El nombre nuevo viene de la lista recargada del servidor.
    await waitFor(() => expect(screen.getByText("Clientes VIP")).toBeInTheDocument());
    expect(screen.queryByText("Ventas")).not.toBeInTheDocument();
  });

  it("el nombre nuevo llega al backend por el endpoint de carpetas", async () => {
    const { fetchMock } = stubApi({ flows: [FLOW], folders: [VENTAS] });
    renderHub();
    await screen.findByText("Ventas");

    await userEvent.click(menuDe("Ventas"));
    await userEvent.click(screen.getByText("Renombrar"));
    const campo = await screen.findByDisplayValue("Ventas");
    await userEvent.clear(campo);
    await userEvent.type(campo, "Clientes VIP{Enter}");

    await waitFor(() => expect(screen.getByText("Clientes VIP")).toBeInTheDocument());
    const [[url, init]] = fetchMock.mock.calls.filter(
      ([u, i]) => (i?.method ?? "GET") === "PATCH" && String(u).includes("/folders/")
    );
    expect(String(url)).toContain(`/automations/folders/${VENTAS.id}`);
    expect(JSON.parse(String(init?.body))).toEqual({ name: "Clientes VIP" });
  });

  it("renombrar no abre la carpeta", async () => {
    stubApi({ flows: [FLOW], folders: [VENTAS] });
    renderHub();
    await screen.findByText("Ventas");

    await userEvent.click(menuDe("Ventas"));
    await userEvent.click(screen.getByText("Renombrar"));
    const campo = await screen.findByDisplayValue("Ventas");
    await userEvent.clear(campo);
    await userEvent.type(campo, "Otro nombre{Enter}");

    await waitFor(() => expect(screen.getByText("Otro nombre")).toBeInTheDocument());
    expect(screen.queryByRole("navigation", { name: "Ubicación" })).not.toBeInTheDocument();
  });
});

describe("Personalizar está preparada, pero todavía no hace nada", () => {
  it("aparece desactivada y pulsarla no cambia nada", async () => {
    const { fetchMock } = stubApi({ flows: [FLOW], folders: [VENTAS] });
    renderHub();
    await screen.findByText("Ventas");

    await userEvent.click(menuDe("Ventas"));
    // Desactivada con el `disabled` nativo del botón, como ya hace «Mover
    // a...» en el menú de una automatización: el navegador se encarga de que
    // no reciba clic ni foco.
    const opcion = screen.getByRole("menuitem", { name: /Personalizar/ });
    expect(opcion).toBeDisabled();

    const antes = fetchMock.mock.calls.length;
    await userEvent.click(opcion);

    // Ni petición, ni diálogo, ni navegación.
    expect(fetchMock.mock.calls.length).toBe(antes);
    expect(screen.queryByDisplayValue("Ventas")).not.toBeInTheDocument();
    expect(screen.getByText("Ventas")).toBeInTheDocument();
  });
});

describe("el menú se cierra como debe", () => {
  it("al elegir una opción", async () => {
    stubApi({ flows: [FLOW], folders: [VENTAS] });
    renderHub();
    await screen.findByText("Ventas");

    await userEvent.click(menuDe("Ventas"));
    await userEvent.click(screen.getByText("Renombrar"));

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("al pulsar fuera", async () => {
    stubApi({ flows: [FLOW], folders: [VENTAS] });
    renderHub();
    await screen.findByText("Ventas");
    await userEvent.click(menuDe("Ventas"));
    expect(await screen.findByRole("menu")).toBeInTheDocument();

    await userEvent.click(document.body);

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("con Escape", async () => {
    stubApi({ flows: [FLOW], folders: [VENTAS] });
    renderHub();
    await screen.findByText("Ventas");
    await userEvent.click(menuDe("Ventas"));
    expect(await screen.findByRole("menu")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });
});

describe("no rompe lo que ya había", () => {
  it("el menú de una automatización sigue con sus propias acciones", async () => {
    stubApi({ flows: [FLOW], folders: [VENTAS] });
    renderHub();
    await screen.findByText(FLOW.name);

    await userEvent.click(menuDe(FLOW.name));

    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Abrir")).toBeInTheDocument();
    expect(within(menu).getByText("Eliminar")).toBeInTheDocument();
    // Las acciones de carpeta no se cuelan en el de una automatización.
    expect(within(menu).queryByText("Personalizar")).not.toBeInTheDocument();
  });
});
