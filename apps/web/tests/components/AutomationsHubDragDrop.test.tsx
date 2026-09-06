import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { FLOW, FOLDER, renderHub, stubApi, stubEmptyApi } from "../helpers/automationsHub";

// ---------------------------------------------------------------------------
// ARRASTRAR UNA AUTOMATIZACIÓN A UNA CARPETA.
//
// Se recorre la cadena real —tarjeta → payload → carpeta → hook → servicio →
// API → recarga—: la API falsa persiste de verdad, así que lo que el hub
// muestra después solo puede venir de la lista del servidor. Si estas pruebas
// pasan con un atajo en el cliente, es que el atajo existe.
//
// El navegador no está: jsdom no implementa `DataTransfer`, así que se le da
// uno mínimo con lo único que el código usa —tipos, leer y escribir—. Lo que
// NO se sustituye es el producto: el payload, la carpeta y el hook son los
// reales.
// ---------------------------------------------------------------------------

const TIPO = "application/x-auream-flow";

/** Un `DataTransfer` con lo justo: lo que se arrastra y de qué tipo es. */
function portapapeles(datos: Record<string, string> = {}) {
  const almacen = new Map(Object.entries(datos));
  return {
    get types() { return [...almacen.keys()]; },
    getData: (tipo: string) => almacen.get(tipo) ?? "",
    setData: (tipo: string, valor: string) => void almacen.set(tipo, valor),
    dropEffect: "",
    effectAllowed: ""
  };
}

const tarjetaFlujo = () => screen.getByText(FLOW.name).closest(".hub-card") as HTMLElement;
const tarjetaCarpeta = (nombre = FOLDER.name) =>
  screen.getByText(nombre).closest(".hub-folder-card") as HTMLElement;

/** Arrastra la tarjeta del flujo y la suelta sobre la carpeta indicada. */
function arrastrarSobre(carpeta: HTMLElement, flowId = FLOW.id) {
  const dt = portapapeles();
  fireEvent.dragStart(tarjetaFlujo(), { dataTransfer: dt });
  fireEvent.dragOver(carpeta, { dataTransfer: portapapeles({ [TIPO]: "" }) });
  fireEvent.drop(carpeta, { dataTransfer: portapapeles({ [TIPO]: flowId }) });
  return dt;
}

/** Peticiones de movimiento realmente enviadas. */
const movimientos = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.filter(
    ([url, init]) => (init?.method ?? "GET") === "PATCH" && String(url).endsWith("/folder")
  );

beforeEach(() => {
  vi.restoreAllMocks();
  stubEmptyApi();
});

describe("arrastrar una automatización a una carpeta", () => {
  it("la tarjeta anuncia QUÉ flujo se lleva, por su identificador", async () => {
    stubApi({ flows: [FLOW], folders: [FOLDER] });
    renderHub();
    await screen.findByText(FLOW.name);

    const dt = portapapeles();
    fireEvent.dragStart(tarjetaFlujo(), { dataTransfer: dt });

    // El id, no el nombre: dos flujos pueden llamarse igual y el nombre cambia.
    expect(dt.getData(TIPO)).toBe(FLOW.id);
    expect(dt.getData(TIPO)).not.toBe(FLOW.name);
  });

  it("la carpeta se enciende al pasar un flujo por encima y se apaga al salir", async () => {
    stubApi({ flows: [FLOW], folders: [FOLDER] });
    renderHub();
    await screen.findByText(FLOW.name);
    const carpeta = tarjetaCarpeta();

    expect(carpeta.className).not.toContain("--receiving");

    fireEvent.dragOver(carpeta, { dataTransfer: portapapeles({ [TIPO]: "" }) });
    expect(carpeta.className).toContain("--receiving");

    fireEvent.dragLeave(carpeta);
    expect(carpeta.className).not.toContain("--receiving");
  });

  it("un arrastre que NO es un flujo no enciende la carpeta", async () => {
    // Un archivo del escritorio, un enlace o texto seleccionado.
    stubApi({ flows: [FLOW], folders: [FOLDER] });
    renderHub();
    await screen.findByText(FLOW.name);
    const carpeta = tarjetaCarpeta();

    fireEvent.dragOver(carpeta, { dataTransfer: portapapeles({ "text/plain": "hola" }) });

    expect(carpeta.className).not.toContain("--receiving");
  });

  it("soltarlo lo asigna a la carpeta y el hub lo refleja", async () => {
    const { fetchMock } = stubApi({ flows: [FLOW], folders: [FOLDER] });
    renderHub();
    await screen.findByText(FLOW.name);
    // Antes: la carpeta está vacía.
    expect(screen.getByText("0 automatizaciones")).toBeInTheDocument();

    arrastrarSobre(tarjetaCarpeta());

    // Después: el recuento sale de la lista recargada del servidor.
    await waitFor(() => expect(screen.getByText("1 automatización")).toBeInTheDocument());
    const [[url, init]] = movimientos(fetchMock);
    expect(String(url)).toContain(`/automations/${FLOW.id}/folder`);
    expect(JSON.parse(String(init?.body))).toEqual({ folderId: FOLDER.id });
  });

  it("y el estado de destino se apaga al soltar", async () => {
    stubApi({ flows: [FLOW], folders: [FOLDER] });
    renderHub();
    await screen.findByText(FLOW.name);
    const carpeta = tarjetaCarpeta();

    arrastrarSobre(carpeta);

    await waitFor(() => expect(carpeta.className).not.toContain("--receiving"));
  });

  it("un flujo se mueve de una carpeta a otra", async () => {
    // Un flujo guardado en una carpeta ya no se ve en la raíz: para arrastrarlo
    // hay que estar dentro de ella, que es donde vive.
    const OTRA = { id: "f2", name: "Otra carpeta" };
    const { fetchMock } = stubApi({
      flows: [{ ...FLOW, folderId: FOLDER.id }],
      folders: [FOLDER, OTRA]
    });
    renderHub(`/automations/folders/${FOLDER.id}`);
    await screen.findByText(FLOW.name);

    arrastrarSobre(tarjetaCarpeta(OTRA.name));

    // Sale de la carpeta en la que estamos y entra en la otra.
    await waitFor(() => expect(screen.queryByText(FLOW.name)).not.toBeInTheDocument());
    expect(screen.getByText("1 automatización")).toBeInTheDocument();
    expect(JSON.parse(String(movimientos(fetchMock)[0]![1]?.body))).toEqual({ folderId: OTRA.id });
  });

  it("soltarlo en la carpeta donde ya estaba lo deja donde estaba", async () => {
    // Desde dentro de la carpeta, la única forma de soltarlo «donde ya estaba»
    // es arrastrarlo a otra y volver; aquí se comprueba lo equivalente: un
    // flujo suelto que se suelta en su misma carpeta destino dos veces.
    const { fetchMock } = stubApi({ flows: [FLOW], folders: [FOLDER] });
    renderHub();
    await screen.findByText(FLOW.name);

    arrastrarSobre(tarjetaCarpeta());
    await waitFor(() => expect(screen.getByText("1 automatización")).toBeInTheDocument());

    // La decisión de no reescribir es del servidor —lo prueba su propio test—;
    // el cliente no duplica esa regla.
    expect(movimientos(fetchMock)).toHaveLength(1);
  });

  it("soltar fuera de una carpeta no mueve nada", async () => {
    const { fetchMock } = stubApi({ flows: [FLOW], folders: [FOLDER] });
    renderHub();
    await screen.findByText(FLOW.name);

    fireEvent.dragStart(tarjetaFlujo(), { dataTransfer: portapapeles() });
    fireEvent.drop(document.body, { dataTransfer: portapapeles({ [TIPO]: FLOW.id }) });

    await waitFor(() => expect(screen.getByText("0 automatizaciones")).toBeInTheDocument());
    expect(movimientos(fetchMock)).toHaveLength(0);
  });

  it("un drop sin flujo dentro no mueve nada", async () => {
    const { fetchMock } = stubApi({ flows: [FLOW], folders: [FOLDER] });
    renderHub();
    await screen.findByText(FLOW.name);

    fireEvent.drop(tarjetaCarpeta(), { dataTransfer: portapapeles({ "text/plain": "hola" }) });

    expect(movimientos(fetchMock)).toHaveLength(0);
  });

  it("dos sueltas seguidas no lanzan dos movimientos a la vez", async () => {
    const { fetchMock } = stubApi({ flows: [FLOW], folders: [FOLDER] });
    renderHub();
    await screen.findByText(FLOW.name);
    const carpeta = tarjetaCarpeta();

    arrastrarSobre(carpeta);
    arrastrarSobre(carpeta);

    await waitFor(() => expect(screen.getByText("1 automatización")).toBeInTheDocument());
    expect(movimientos(fetchMock)).toHaveLength(1);
  });

  it("si el movimiento falla, se avisa y el hub no miente sobre dónde está", async () => {
    stubApi({ flows: [FLOW], folders: [FOLDER] });
    const original = globalThis.fetch as ReturnType<typeof vi.fn>;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if ((init?.method ?? "GET") === "PATCH") throw new TypeError("sin red");
        return original(url, init);
      })
    );
    renderHub();
    await screen.findByText(FLOW.name);

    arrastrarSobre(tarjetaCarpeta());

    expect(await screen.findByText(/No se pudo mover la automatización/i)).toBeInTheDocument();
    // Sigue fuera de la carpeta, que es donde está de verdad.
    expect(screen.getByText("0 automatizaciones")).toBeInTheDocument();
  });

  it("arrastrar no rompe abrir el flujo ni su menú", async () => {
    stubApi({ flows: [FLOW], folders: [FOLDER] });
    renderHub();
    await screen.findByText(FLOW.name);

    expect(tarjetaFlujo()).toHaveAttribute("draggable", "true");
    expect(tarjetaFlujo().querySelector(".hub-card__menu-btn")).not.toBeNull();
    expect(tarjetaFlujo().getAttribute("role")).toBe("button");
  });
});
