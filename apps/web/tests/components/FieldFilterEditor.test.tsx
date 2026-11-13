import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ContactFieldSummary } from "@contracts/ContactFieldContracts";
import type { FieldFilter } from "@contracts/ContactFieldFilters";
import { FieldFilterEditor } from "../../src/shared/contact-fields/FieldFilterEditor";
import { ContactsSection } from "../../src/features/crm/contacts/components/ContactsSection";
import { contact, stubContactsApi } from "../helpers/contactsApi";

// ---------------------------------------------------------------------------
// Filtrar por Campos del cliente (Difusiones y el CRM): cada tipo con su
// regla; hacia afuera solo salen los filtros completos; y en el CRM la lista
// se pide con esos filtros.
// ---------------------------------------------------------------------------

const field = (key: string, label: string, type: ContactFieldSummary["type"], options: string[] = []): ContactFieldSummary =>
  ({ id: key, key, label, type, options, createdAt: "", updatedAt: "", filled: 1, uses: [] });
const FIELDS = [field("ciudad", "Ciudad", "list", ["Medellín", "Bogotá"]), field("ya_compro", "Ya compró", "boolean"), field("presupuesto", "Presupuesto", "number")];

function Editor({ onFilters }: { readonly onFilters: (filters: FieldFilter[]) => void }) {
  const [value, setValue] = useState<FieldFilter[]>([]);
  return <FieldFilterEditor fields={FIELDS} value={value} onChange={(filters) => (setValue(filters), onFilters(filters))} />;
}

beforeEach(() => vi.restoreAllMocks());

describe("filtrar por campo", () => {
  it("una lista se filtra tocando opciones; a medias no sale nada", async () => {
    const onFilters = vi.fn();
    render(<Editor onFilters={onFilters} />);
    await userEvent.click(screen.getByRole("button", { name: "+ Filtrar por campo" }));
    expect(onFilters).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Medellín" }));
    expect(onFilters).toHaveBeenLastCalledWith([{ key: "ciudad", op: "in", values: ["Medellín"] }]);
    expect(screen.getByRole("button", { name: "Medellín" })).toHaveAttribute("aria-pressed", "true");
  });

  it("sí o no, y un número entre dos valores; quitar un filtro lo saca", async () => {
    const onFilters = vi.fn();
    render(<Editor onFilters={onFilters} />);
    await userEvent.click(screen.getByRole("button", { name: "+ Filtrar por campo" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Campo del filtro 1" }), "Ya compró");
    expect(onFilters).toHaveBeenLastCalledWith([{ key: "ya_compro", op: "yes" }]);

    await userEvent.click(screen.getByRole("button", { name: "+ Filtrar por campo" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Campo del filtro 2" }), "Presupuesto");
    await userEvent.type(screen.getByLabelText("Presupuesto: desde"), "500000");
    expect(onFilters).toHaveBeenLastCalledWith([{ key: "ya_compro", op: "yes" }, { key: "presupuesto", op: "between", min: "500000" }]);

    await userEvent.click(screen.getByRole("button", { name: "Quitar el filtro 1" }));
    expect(onFilters).toHaveBeenLastCalledWith([{ key: "presupuesto", op: "between", min: "500000" }]);
  });

  it("en el CRM la lista de contactos se pide con los filtros", async () => {
    const api = stubContactsApi({ contacts: [contact({ id: "c1", name: "Ana", phone: "573001112233" })], fields: FIELDS });
    render(<MemoryRouter><ContactsSection /></MemoryRouter>);
    await userEvent.click(await screen.findByRole("button", { name: "+ Filtrar por campo" }));
    await userEvent.click(screen.getByRole("button", { name: "Bogotá" }));
    await waitFor(() => {
      const last = api.fetchMock.mock.calls.map(([url]) => new URL(String(url), "http://api.test")).filter((url) => url.pathname.endsWith("/contacts")).at(-1)!;
      expect(JSON.parse(last.searchParams.get("fields")!)).toEqual([{ key: "ciudad", op: "in", values: ["Bogotá"] }]);
    });
  });
});
