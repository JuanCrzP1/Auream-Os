import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  FLOW,
  FOLDER,
  folderPostCalls,
  header,
  openFolderDialog,
  renderHub,
  stubApi,
  stubEmptyApi
} from "../helpers/automationsHub";

// ---------------------------------------------------------------------------
// Creación de carpeta desde el hub: diálogo → servicio → recarga → estado.
//
// Recorre la cadena real: la API falsa persiste de verdad, así que la
// transición EMPTY → POPULATED sólo puede venir del estado derivado de la
// lista del servidor, no de un flag local.
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.restoreAllMocks();
  stubEmptyApi();
});

describe("AutomationsHubPage — creación de carpeta", () => {
  it("Nueva carpeta abre el diálogo con el campo enfocado", async () => {
    stubApi();
    renderHub();
    await screen.findByText(/sin automatizaciones/i);

    await openFolderDialog();

    expect(screen.getByLabelText("Nombre de la carpeta")).toHaveFocus();
  });

  it("no crea nada con el nombre vacío", async () => {
    const { fetchMock } = stubApi();
    renderHub();
    await screen.findByText(/sin automatizaciones/i);
    await openFolderDialog();

    expect(screen.getByRole("button", { name: /crear carpeta/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Nombre de la carpeta"), "   {Enter}");

    expect(folderPostCalls(fetchMock)).toHaveLength(0);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Escape cancela sin crear", async () => {
    const { fetchMock } = stubApi();
    renderHub();
    await screen.findByText(/sin automatizaciones/i);
    await openFolderDialog();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(folderPostCalls(fetchMock)).toHaveLength(0);
    expect(screen.getByText(/sin automatizaciones/i)).toBeInTheDocument();
  });

  it("Enter crea la carpeta llamando a POST /automations/folders", async () => {
    const { fetchMock } = stubApi();
    renderHub();
    await screen.findByText(/sin automatizaciones/i);
    await openFolderDialog();

    await userEvent.type(screen.getByLabelText("Nombre de la carpeta"), "  Ventas  {Enter}");

    await waitFor(() => expect(folderPostCalls(fetchMock)).toHaveLength(1));
    const [url, init] = folderPostCalls(fetchMock)[0] as [string, RequestInit];
    expect(url).toContain("/automations/folders");
    expect(JSON.parse(String(init.body))).toEqual({ name: "Ventas" });
  });

  it("cierra el diálogo al terminar", async () => {
    stubApi();
    renderHub();
    await screen.findByText(/sin automatizaciones/i);
    await openFolderDialog();

    await userEvent.type(screen.getByLabelText("Nombre de la carpeta"), "Ventas{Enter}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("la carpeta creada aparece en la lista y el empty state desaparece", async () => {
    stubApi();
    renderHub();
    await screen.findByText(/sin automatizaciones/i);
    await openFolderDialog();
    await userEvent.type(screen.getByLabelText("Nombre de la carpeta"), "Ventas{Enter}");

    expect(await screen.findByText("Ventas")).toBeInTheDocument();
    expect(screen.queryByText(/sin automatizaciones/i)).not.toBeInTheDocument();
  });

  it("tras crear la carpeta aparece el botón Nueva en la cabecera", async () => {
    stubApi();
    renderHub();
    await screen.findByText(/sin automatizaciones/i);
    await openFolderDialog();
    await userEvent.type(screen.getByLabelText("Nombre de la carpeta"), "Ventas{Enter}");
    await screen.findByText("Ventas");

    expect(within(header()).getByRole("button", { name: /^nueva$/i })).toBeInTheDocument();
  });

  it("con contenido, Nueva carpeta vive en la toolbar y sólo ahí", async () => {
    stubApi({ flows: [FLOW] });
    renderHub();
    await screen.findByText("Flujo de prueba");

    const button = screen.getByRole("button", { name: /nueva carpeta/i });
    expect(screen.getAllByRole("button", { name: /nueva carpeta/i })).toHaveLength(1);
    expect(header()).not.toContainElement(button);
  });

  it("la acción de la toolbar abre el mismo diálogo", async () => {
    stubApi({ flows: [FLOW] });
    renderHub();
    await screen.findByText("Flujo de prueba");

    await openFolderDialog();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre de la carpeta")).toHaveFocus();
  });

  it("permite crear una segunda carpeta cuando ya existe contenido", async () => {
    const { fetchMock } = stubApi({ folders: [FOLDER] });
    renderHub();
    await screen.findByText("Carpeta de prueba");

    await openFolderDialog();
    await userEvent.type(screen.getByLabelText("Nombre de la carpeta"), "Segunda{Enter}");

    expect(await screen.findByText("Segunda")).toBeInTheDocument();
    expect(screen.getByText("Carpeta de prueba")).toBeInTheDocument();
    expect(folderPostCalls(fetchMock)).toHaveLength(1);

    // Y una tercera: la acción sigue disponible después de crear.
    await openFolderDialog();
    await userEvent.type(screen.getByLabelText("Nombre de la carpeta"), "Tercera{Enter}");

    expect(await screen.findByText("Tercera")).toBeInTheDocument();
    expect(folderPostCalls(fetchMock)).toHaveLength(2);
  });

  it("muestra el error del servidor sin dejar la carpeta a medias", async () => {
    stubApi();
    renderHub();
    await screen.findByText(/sin automatizaciones/i);
    await openFolderDialog();

    // La creación falla justo al enviar: el diálogo debe seguir abierto.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => JSON.stringify({ message: "El nombre de la carpeta es obligatorio" })
    } as unknown as Response));

    await userEvent.type(screen.getByLabelText("Nombre de la carpeta"), "Ventas{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(/no se pudo crear/i);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
