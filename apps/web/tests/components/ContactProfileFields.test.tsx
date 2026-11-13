import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ContactsSection } from "../../src/features/crm/contacts/components/ContactsSection";
import { VIP, contact, stubContactsApi } from "../helpers/contactsApi";

// ---------------------------------------------------------------------------
// La ficha del cliente en el CRM con sus Campos del cliente: cada campo en la
// forma de su tipo, de dónde salió cada dato, lo suelto aparte, y al guardar
// solo se manda lo que cambió.
// ---------------------------------------------------------------------------

const ANA = contact({ id: "c1", name: "Ana Pérez", phone: "573001112233", labels: [VIP] });

beforeEach(() => vi.restoreAllMocks());

describe("ficha del contacto: Campos del cliente", () => {
  it("la ficha muestra cada campo en su forma, de dónde salió, y guarda solo lo que cambió", async () => {
    const field = (key: string, label: string, type: "list" | "boolean", options: string[] = []) => ({ id: key, key, label, type, options, createdAt: "", updatedAt: "", filled: 1, uses: [] });
    const api = stubContactsApi({
      contacts: [contact({ ...ANA, customFields: { ciudad: "Medellín", codigo_promo: "VERANO" } })],
      labels: [VIP],
      fields: [field("ciudad", "Ciudad", "list", ["Medellín", "Bogotá"]), field("ya_compro", "Ya compró", "boolean")],
      origins: { ciudad: { source: "flow", at: new Date().toISOString(), flowName: "Ventas", blockName: "¿En qué ciudad estás?", blockType: "question" } }
    });
    render(<MemoryRouter><ContactsSection /></MemoryRouter>);
    await userEvent.click(await screen.findByRole("button", { name: "Ana Pérez" }));
    const ficha = screen.getByRole("dialog");

    const ciudad = await within(ficha).findByRole("combobox", { name: "Ciudad" });
    expect(ciudad).toHaveValue("Medellín");
    expect(within(ficha).getByText("Lo respondió en «¿En qué ciudad estás?» del flujo «Ventas» · hoy")).toBeInTheDocument();
    expect(within(within(ficha).getByRole("group", { name: "Otros datos que guardó un flujo" })).getByText("codigo_promo")).toBeInTheDocument();

    await userEvent.selectOptions(ciudad, "Bogotá");
    await userEvent.click(within(within(ficha).getByRole("group", { name: "Ya compró" })).getByRole("button", { name: "Sí" }));
    await userEvent.click(within(ficha).getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const patch = api.fetchMock.mock.calls.find(([url, init]) => String(url).includes("/contact-fields/values/") && init?.method === "PATCH")!;
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ changes: { ciudad: "Bogotá", ya_compro: true } });
    expect(api.contacts()[0]!.customFields).toEqual({ ciudad: "Bogotá", codigo_promo: "VERANO", ya_compro: true });
  });
});
