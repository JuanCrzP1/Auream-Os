import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactsSection } from "../../src/features/crm/contacts/components/ContactsSection";
import { LEAD, VIP, contact, stubContactsApi } from "../helpers/contactsApi";

// ---------------------------------------------------------------------------
// La pestaña «Contactos» del CRM: listar, buscar, filtrar, editar la ficha y gestionar
// el catálogo de etiquetas. La API falsa guarda de verdad.
// ---------------------------------------------------------------------------

const ANA = contact({ id: "c1", name: "Ana Pérez", phone: "573001112233", labels: [VIP], customFields: { ciudad: "Medellín" } });
const LUIS = contact({ id: "c2", name: "Luis Gómez", phone: "573004445566" });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("lista de contactos", () => {
  it("muestra los contactos con su teléfono y etiquetas", async () => {
    stubContactsApi({ contacts: [ANA, LUIS], labels: [VIP, LEAD] });
    render(<ContactsSection />);

    const fila = (await screen.findByRole("button", { name: "Ana Pérez" })).closest("tr")!;
    expect(within(fila).getByText("+573001112233")).toBeInTheDocument();
    expect(within(fila).getByText("VIP")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Luis Gómez" })).toBeInTheDocument();
  });

  it("busca en el servidor y filtra por etiqueta", async () => {
    const { fetchMock } = stubContactsApi({ contacts: [ANA, LUIS], labels: [VIP] });
    render(<ContactsSection />);
    await screen.findByRole("button", { name: "Luis Gómez" });

    await userEvent.type(screen.getByLabelText("Buscar contactos"), "luis");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Ana Pérez" })).not.toBeInTheDocument());
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("search=luis"))).toBe(true);

    await userEvent.clear(screen.getByLabelText("Buscar contactos"));
    await userEvent.selectOptions(screen.getByLabelText("Filtrar por etiqueta"), "l1");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Luis Gómez" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Ana Pérez" })).toBeInTheDocument();
  });

  it("sin contactos explica de dónde llegan", async () => {
    stubContactsApi();
    render(<ContactsSection />);

    expect(await screen.findByText(/llegarán solos/i)).toBeInTheDocument();
  });
});

describe("ficha del contacto", () => {
  it("cambia nombre y etiquetas y la tabla refleja lo guardado", async () => {
    const api = stubContactsApi({ contacts: [ANA], labels: [VIP, LEAD] });
    render(<ContactsSection />);
    await userEvent.click(await screen.findByRole("button", { name: "Ana Pérez" }));

    const ficha = screen.getByRole("dialog");
    expect(within(ficha).getByText("ciudad")).toBeInTheDocument();
    expect(within(ficha).getByText("Medellín")).toBeInTheDocument();

    const nombre = within(ficha).getByLabelText("Nombre");
    await userEvent.clear(nombre);
    await userEvent.type(nombre, "Ana María");
    await userEvent.click(within(ficha).getByRole("button", { name: "VIP" }));
    await userEvent.click(within(ficha).getByRole("button", { name: "Lead" }));
    await userEvent.click(within(ficha).getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.contacts()[0]).toMatchObject({ name: "Ana María", labels: [LEAD] });
    const fila = screen.getByRole("button", { name: "Ana María" }).closest("tr")!;
    expect(within(fila).getByText("Lead")).toBeInTheDocument();
    expect(within(fila).queryByText("VIP")).not.toBeInTheDocument();
  });

  it("crea un contacto nuevo y abre su ficha", async () => {
    const api = stubContactsApi();
    render(<ContactsSection />);
    await userEvent.click(screen.getByRole("button", { name: "Nuevo contacto" }));

    const dialogo = screen.getByRole("dialog", { name: "Nuevo contacto" });
    await userEvent.type(within(dialogo).getByLabelText(/teléfono/i), "+57 300 999 8877");
    await userEvent.type(within(dialogo).getByLabelText("Nombre"), "Marta");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Crear" }));

    expect(await screen.findByRole("dialog", { name: "Marta" })).toBeInTheDocument();
    expect(api.contacts()).toHaveLength(1);
    expect(api.contacts()[0]?.phone).toBe("573009998877");
  });
});

describe("catálogo de etiquetas", () => {
  async function abrirEtiquetas() {
    render(<ContactsSection />);
    await userEvent.click(screen.getByRole("tab", { name: /etiquetas/i }));
  }

  it("crea una etiqueta con su color", async () => {
    const api = stubContactsApi({ labels: [VIP] });
    await abrirEtiquetas();

    await userEvent.type(screen.getByLabelText("Nombre de la nueva etiqueta"), "Interesado");
    await userEvent.click(screen.getByRole("radio", { name: "Color #10b981" }));
    await userEvent.click(screen.getByRole("button", { name: "Crear etiqueta" }));

    expect(await screen.findByText("Interesado")).toBeInTheDocument();
    expect(api.labels().at(-1)).toMatchObject({ name: "Interesado", color: "#10b981" });
  });

  it("un nombre repetido muestra el aviso del servidor", async () => {
    stubContactsApi({ labels: [VIP] });
    await abrirEtiquetas();
    await screen.findByText("VIP");

    await userEvent.type(screen.getByLabelText("Nombre de la nueva etiqueta"), "vip");
    await userEvent.click(screen.getByRole("button", { name: "Crear etiqueta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ya existe una etiqueta con ese nombre.");
  });

  it("renombra y borra (con confirmación)", async () => {
    const api = stubContactsApi({ contacts: [ANA], labels: [VIP, LEAD] });
    await abrirEtiquetas();

    await userEvent.click(await screen.findByRole("button", { name: "Editar Lead" }));
    const campo = screen.getByLabelText("Nombre de la etiqueta");
    await userEvent.clear(campo);
    await userEvent.type(campo, "Prospecto");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Prospecto")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Borrar VIP" }));
    await userEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));
    await waitFor(() => expect(api.labels().map((l) => l.name)).toEqual(["Prospecto"]));
    expect(api.contacts()[0]?.labels).toEqual([]);
  });
});

describe("estados de la lista", () => {
  it("si falla la carga, muestra un aviso claro y «Reintentar» la recupera", async () => {
    const api = stubContactsApi({ contacts: [ANA], labels: [VIP] });
    const real = api.fetchMock.getMockImplementation()!;
    let caida = true;
    api.fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      caida ? ({ ok: false, status: 503, text: async () => "{}", json: async () => ({}) } as unknown as Response) : real(url, init)
    );
    render(<ContactsSection />);

    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent("No pudimos cargar tus contactos");

    caida = false;
    await userEvent.click(within(aviso).getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("button", { name: "Ana Pérez" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sin resultados ofrece limpiar los filtros", async () => {
    stubContactsApi({ contacts: [ANA] });
    render(<ContactsSection />);
    await screen.findByRole("button", { name: "Ana Pérez" });

    await userEvent.type(screen.getByLabelText("Buscar contactos"), "zzz");
    expect(await screen.findByText("Sin resultados")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(await screen.findByRole("button", { name: "Ana Pérez" })).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar contactos")).toHaveValue("");
  });

  it("sin contactos invita a agregar uno", async () => {
    stubContactsApi();
    render(<ContactsSection />);

    await userEvent.click(await screen.findByRole("button", { name: "Agregar contacto" }));
    expect(screen.getByRole("dialog", { name: "Nuevo contacto" })).toBeInTheDocument();
  });
});
