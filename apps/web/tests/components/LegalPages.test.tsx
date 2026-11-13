import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LegalPage } from "../../src/features/legal/LegalPage";
import { fillLegal, LEGAL_OWNER } from "../../src/features/legal/legalOwner";
import { ThemeProvider } from "../../src/shared/theme/context/ThemeContext";

// ---------------------------------------------------------------------------
// Páginas legales públicas (las pide Meta para aprobar la app): privacidad,
// términos y eliminación de datos, sin sesión, con enlaces entre ellas; la de
// eliminación muestra el estado de una solicitud hecha desde Facebook.
// ---------------------------------------------------------------------------

const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response;

function renderAt(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/privacidad" element={<LegalPage id="privacy" />} />
          <Route path="/terminos" element={<LegalPage id="terms" />} />
          <Route path="/eliminar-datos" element={<LegalPage id="deletion" />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("páginas legales", () => {
  it("privacidad: responsable, permiso solo de lectura de Meta, que no se venden datos, derechos y plazos de la ley", async () => {
    renderAt("/privacidad");
    expect(screen.getByRole("heading", { level: 1, name: "Política de privacidad y tratamiento de datos" })).toBeInTheDocument();
    const doc = screen.getByRole("article");
    expect(doc).toHaveTextContent("Ley 1581 de 2012");
    expect(doc).toHaveTextContent("solo para leer");
    expect(doc).toHaveTextContent("no los vende, no los alquila ni los comparte");
    expect(doc).toHaveTextContent("10 días hábiles");
    expect(doc).toHaveTextContent("Superintendencia de Industria y Comercio");
    expect(within(doc).getAllByRole("link", { name: LEGAL_OWNER.email })[0]).toHaveAttribute("href", `mailto:${LEGAL_OWNER.email}`);
    expect(doc).not.toHaveTextContent("{{");
    expect(document.title).toBe("Política de privacidad y tratamiento de datos · Auream");
  });

  it("se pasa de un documento a otro y el actual queda marcado", async () => {
    renderAt("/privacidad");
    const tabs = screen.getByRole("navigation", { name: "Documentos legales" });
    expect(within(tabs).getByRole("link", { name: "Privacidad" })).toHaveAttribute("aria-current", "page");
    await userEvent.click(within(tabs).getByRole("link", { name: "Términos" }));
    expect(screen.getByRole("heading", { level: 1, name: "Términos y condiciones" })).toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveTextContent("enviar spam");
  });

  it("eliminación de datos: cómo quitar el acceso de Meta y, con el código de Facebook, el estado de la solicitud", async () => {
    const fetchMock = vi.fn(async (input: string) =>
      String(input).includes("/meta/data-deletion/ABCDEFGH2345")
        ? reply(200, { code: "ABCDEFGH2345", status: "completed", requestedAt: "2026-11-12T20:00:00.000Z", deletedConnections: 1 })
        : reply(404, { message: "No encontramos una solicitud con ese código." })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = renderAt("/eliminar-datos?codigo=ABCDEFGH2345");
    expect(screen.getByRole("article")).toHaveTextContent("Integraciones comerciales");
    expect(await screen.findByText("Solicitud ABCDEFGH2345: completada ✓")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Borramos el acceso a Meta Ads");
    unmount();

    renderAt("/eliminar-datos?codigo=NOEXISTE2345");
    expect(await screen.findByText(/No encontramos una solicitud con el código/)).toBeInTheDocument();
  });

  it("los datos del responsable salen de un solo lugar; sin nombre se muestra la marca", () => {
    const text = "{{RESPONSABLE}} · {{DOMICILIO}} · {{CORREO}} · {{FECHA}}";
    expect(fillLegal(text, { ...LEGAL_OWNER, holder: "", city: "" })).toBe(`Auream · Colombia · ${LEGAL_OWNER.email} · ${LEGAL_OWNER.effectiveDate}`);
    expect(fillLegal(text, { ...LEGAL_OWNER, holder: "Ana Pérez", city: "Medellín" })).toBe(`Ana Pérez, titular de la marca Auream · Medellín, Colombia · ${LEGAL_OWNER.email} · ${LEGAL_OWNER.effectiveDate}`);
  });
});
