import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SYSTEM_CONTACT_FIELDS, type ContactFieldsResponse } from "@contracts/ContactFieldContracts";
import type { BusinessDataResponse } from "@contracts/BusinessDataContracts";
import { DataSettings } from "../../src/app/settings/data/DataSettings";
import { LEGACY_SETTINGS } from "../../src/app/settings/settings-sections";

// ---------------------------------------------------------------------------
// Configuración › Campos y datos: lo que va entre llaves en los mensajes, en
// un solo lugar. Dos pestañas (Campos del cliente · Datos del negocio), un
// solo «Cómo funciona» que explica la diferencia con un mismo mensaje y un
// solo «Nuevo dato» que primero pregunta qué clase de dato es. Las
// direcciones de antes llevan a su pestaña.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

const FIELDS: ContactFieldsResponse = {
  fields: [{ id: "f1", key: "ciudad", label: "Ciudad", type: "text", options: [], createdAt: "", updatedAt: "", filled: 12, uses: [] }],
  system: SYSTEM_CONTACT_FIELDS, totalContacts: 20, undefinedKeys: 0, canManage: true
};
const BUSINESS: BusinessDataResponse = {
  data: [{ id: "d1", key: "g_horario", label: "Horario", type: "text", value: "8 a 6", description: "", schedules: [], createdAt: "", updatedAt: "", uses: [], example: null }],
  canManage: true, timeZone: "America/Bogota"
};

function stub() {
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const path = new URL(String(input), "http://api.test").pathname;
    if (path === "/contact-fields") return reply(200, FIELDS);
    if (path === "/business-data") return reply(200, BUSINESS);
    return reply(404, {});
  }));
}

function Where() {
  const location = useLocation();
  return <output aria-label="dirección">{location.pathname + location.search}</output>;
}

const page = (at = "/settings/data") =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <Routes><Route path="/settings/data" element={<><DataSettings /><Where /></>} /></Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  stub();
});

describe("Campos y datos", () => {
  it("dos pestañas en una sola pantalla; la de cada una va en la dirección", async () => {
    page();
    expect(await screen.findByRole("button", { name: /Ciudad/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Datos del negocio" }));
    expect(await screen.findByRole("button", { name: /Horario/ })).toBeInTheDocument();
    expect(screen.getByLabelText("dirección")).toHaveTextContent("/settings/data?tab=business");
  });

  it("las direcciones de antes llevan a su pestaña", () => {
    expect(LEGACY_SETTINGS).toEqual({ "contact-fields": "/settings/data?tab=customer", "business-data": "/settings/data?tab=business" });
  });

  it("un solo «Cómo funciona»: el mismo mensaje con los dos, y se cierra y se vuelve a abrir", async () => {
    page();
    const how = screen.getByRole("region", { name: "Guárdalo una vez. Úsalo en todos tus mensajes." });
    expect(how).toHaveTextContent("Te escribimos desde {ciudad}. Atendemos {g_horario}.");
    expect(how).toHaveTextContent("Laura: …desde Medellín. Atendemos de 8 a 6.");
    expect(how).toHaveTextContent("Pedro: …desde Lima. Atendemos de 8 a 6.");
    await userEvent.click(within(how).getByRole("button", { name: "Entendido" }));
    expect(screen.queryByRole("region", { name: /Guárdalo una vez/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "¿Cómo funciona?" }));
    expect(screen.getByRole("region", { name: /Guárdalo una vez/ })).toBeInTheDocument();
  });

  it("«Nuevo dato» pregunta primero; elegir «Dato del negocio» lleva a su pestaña y abre crear", async () => {
    page();
    await userEvent.click(await screen.findByRole("button", { name: "Nuevo dato" }));
    const choice = screen.getByRole("dialog", { name: "¿Qué vas a guardar?" });
    expect(choice).toHaveTextContent("Campo del clienteCambia con cada persona.");
    await userEvent.click(within(choice).getByRole("button", { name: /Dato del negocio/ }));
    expect(await screen.findByRole("dialog", { name: "Nuevo dato del negocio" })).toBeInTheDocument();
    expect(screen.getByLabelText("dirección")).toHaveTextContent("tab=business");
  });

  it("elegir «Campo del cliente» abre «Nuevo campo» en su pestaña", async () => {
    page("/settings/data?tab=business");
    await userEvent.click(await screen.findByRole("button", { name: "Nuevo dato" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "¿Qué vas a guardar?" })).getByRole("button", { name: /Campo del cliente/ }));
    expect(await screen.findByRole("dialog", { name: "Nuevo campo" })).toBeInTheDocument();
    expect(screen.getByLabelText("dirección")).toHaveTextContent("tab=customer");
  });
});
