import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FLOW, renderHub, stubApi, stubEmptyApi } from "../helpers/automationsHub";
import type { AutomationFolderSummary, AutomationSummary } from "@contracts/AutomationContracts";

// ---------------------------------------------------------------------------
// UNA CARPETA COMO CONTENEDOR DE VERDAD.
//
// Antes el movimiento persistía pero la automatización seguía en la raíz y no
// había forma de entrar en la carpeta: el recuento era la única señal. Aquí se
// prueba el comportamiento completo —la raíz deja de mostrarla, la carpeta se
// abre, la contiene, y se puede sacar— recorriendo la cadena real contra la
// API falsa, que persiste.
// ---------------------------------------------------------------------------

const TIPO = "application/x-auream-flow";

const VENTAS: AutomationFolderSummary = { id: "c1", name: "Ventas" };
const SOPORTE: AutomationFolderSummary = { id: "c2", name: "Soporte" };

const SUELTO: AutomationSummary = { ...FLOW, id: "s1", key: "s1", name: "Suelto" };
const EN_VENTAS: AutomationSummary = { ...FLOW, id: "v1", key: "v1", name: "De ventas", folderId: "c1" };

function portapapeles(datos: Record<string, string> = {}) {
  const almacen = new Map(Object.entries(datos));
  return {
    get types() { return [...almacen.keys()]; },
    getData: (t: string) => almacen.get(t) ?? "",
    setData: (t: string, v: string) => void almacen.set(t, v),
    dropEffect: "",
    effectAllowed: ""
  };
}

const tarjeta = (nombre: string) => screen.getByText(nombre).closest(".hub-card") as HTMLElement;
const carpeta = (nombre: string) => screen.getByText(nombre).closest(".hub-folder-card") as HTMLElement;
const flujosVisibles = () =>
  [...document.querySelectorAll(".hub-card__name")].map((e) => e.textContent);

function soltarSobre(destino: HTMLElement, origen: string, flowId: string) {
  fireEvent.dragStart(tarjeta(origen), { dataTransfer: portapapeles() });
  fireEvent.drop(destino, { dataTransfer: portapapeles({ [TIPO]: flowId }) });
}

beforeEach(() => {
  vi.restoreAllMocks();
  stubEmptyApi();
});

describe("la raíz solo muestra lo que no está en una carpeta", () => {
  it("una automatización guardada en una carpeta no aparece en la raíz", async () => {
    stubApi({ flows: [SUELTO, EN_VENTAS], folders: [VENTAS] });
    renderHub();
    await screen.findByText("Suelto");

    expect(flujosVisibles()).toEqual(["Suelto"]);
    expect(screen.queryByText("De ventas")).not.toBeInTheDocument();
  });

  it("al mover una automatización a una carpeta, desaparece de la raíz", async () => {
    stubApi({ flows: [SUELTO], folders: [VENTAS] });
    renderHub();
    await screen.findByText("Suelto");

    soltarSobre(carpeta("Ventas"), "Suelto", SUELTO.id);

    await waitFor(() => expect(screen.queryByText("Suelto")).not.toBeInTheDocument());
    expect(screen.getByText("1 automatización")).toBeInTheDocument();
  });
});

describe("abrir una carpeta", () => {
  it("muestra únicamente sus automatizaciones", async () => {
    stubApi({ flows: [SUELTO, EN_VENTAS], folders: [VENTAS] });
    renderHub();
    await screen.findByText("Suelto");

    await userEvent.click(carpeta("Ventas"));

    await waitFor(() => expect(flujosVisibles()).toEqual(["De ventas"]));
    expect(screen.queryByText("Suelto")).not.toBeInTheDocument();
  });

  it("dice dónde estamos y ofrece el camino de vuelta", async () => {
    stubApi({ flows: [EN_VENTAS], folders: [VENTAS] });
    renderHub();
    await screen.findByText("Ventas");

    await userEvent.click(carpeta("Ventas"));

    const migas = await screen.findByRole("navigation", { name: "Ubicación" });
    expect(migas).toHaveTextContent("Automatizaciones");
    expect(migas).toHaveTextContent("Ventas");
  });

  it("volver a la raíz la deja como estaba", async () => {
    stubApi({ flows: [SUELTO, EN_VENTAS], folders: [VENTAS] });
    renderHub();
    await screen.findByText("Suelto");
    await userEvent.click(carpeta("Ventas"));
    await screen.findByText("De ventas");

    await userEvent.click(screen.getByRole("button", { name: "Automatizaciones" }));

    await waitFor(() => expect(flujosVisibles()).toEqual(["Suelto"]));
  });

  it("una carpeta vacía lo dice, sin ofrecer acciones que no tocan", async () => {
    stubApi({ flows: [SUELTO], folders: [VENTAS] });
    renderHub();
    await screen.findByText("Suelto");

    await userEvent.click(carpeta("Ventas"));

    expect(await screen.findByText(/Esta carpeta está vacía/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /explorar plantillas/i })).not.toBeInTheDocument();
  });

  it("entrar por la URL de la carpeta funciona igual: recargar no pierde el sitio", async () => {
    stubApi({ flows: [SUELTO, EN_VENTAS], folders: [VENTAS] });
    renderHub("/automations/folders/c1");

    await screen.findByText("De ventas");
    expect(flujosVisibles()).toEqual(["De ventas"]);
  });

  it("la carpeta abierta no se ofrece a sí misma como destino", async () => {
    stubApi({ flows: [EN_VENTAS], folders: [VENTAS, SOPORTE] });
    renderHub("/automations/folders/c1");
    await screen.findByText("De ventas");

    expect(screen.getByText("Soporte")).toBeInTheDocument();
    // «Ventas» solo aparece en las migas, no como tarjeta de destino.
    expect(document.querySelectorAll(".hub-folder-card")).toHaveLength(1);
  });
});

describe("mover entre ubicaciones", () => {
  it("de una carpeta a otra: sale de la primera y entra en la segunda", async () => {
    stubApi({ flows: [EN_VENTAS], folders: [VENTAS, SOPORTE] });
    renderHub("/automations/folders/c1");
    await screen.findByText("De ventas");

    soltarSobre(carpeta("Soporte"), "De ventas", EN_VENTAS.id);

    // Ya no está en Ventas, que es donde seguimos.
    await waitFor(() => expect(screen.queryByText("De ventas")).not.toBeInTheDocument());
    expect(await screen.findByText(/Esta carpeta está vacía/i)).toBeInTheDocument();
    expect(screen.getByText("1 automatización")).toBeInTheDocument();
  });

  it("sacarla a la raíz arrastrándola a «Automatizaciones»", async () => {
    stubApi({ flows: [EN_VENTAS], folders: [VENTAS] });
    renderHub("/automations/folders/c1");
    await screen.findByText("De ventas");

    const raiz = screen.getByRole("button", { name: "Automatizaciones" });
    fireEvent.dragStart(tarjeta("De ventas"), { dataTransfer: portapapeles() });
    fireEvent.dragOver(raiz, { dataTransfer: portapapeles({ [TIPO]: "" }) });
    expect(raiz.className).toContain("--receiving");
    fireEvent.drop(raiz, { dataTransfer: portapapeles({ [TIPO]: EN_VENTAS.id }) });

    // Sale de la carpeta...
    await waitFor(() => expect(screen.queryByText("De ventas")).not.toBeInTheDocument());
    // ...y está en la raíz.
    await userEvent.click(raiz);
    await waitFor(() => expect(flujosVisibles()).toEqual(["De ventas"]));
  });

  it("un arrastre ajeno no enciende el camino de vuelta", async () => {
    stubApi({ flows: [EN_VENTAS], folders: [VENTAS] });
    renderHub("/automations/folders/c1");
    await screen.findByText("De ventas");

    const raiz = screen.getByRole("button", { name: "Automatizaciones" });
    fireEvent.dragOver(raiz, { dataTransfer: portapapeles({ "text/plain": "hola" }) });

    expect(raiz.className).not.toContain("--receiving");
  });
});

describe("lo que ya funcionaba sigue funcionando dentro de una carpeta", () => {
  it("se abre el flujo y el menú de la tarjeta responde", async () => {
    stubApi({ flows: [EN_VENTAS], folders: [VENTAS] });
    renderHub("/automations/folders/c1");
    await screen.findByText("De ventas");

    expect(tarjeta("De ventas").querySelector(".hub-card__menu-btn")).not.toBeNull();
    expect(tarjeta("De ventas")).toHaveAttribute("draggable", "true");

    await userEvent.click(tarjeta("De ventas"));
    expect(await screen.findByText("Builder page")).toBeInTheDocument();
  });
});
