import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AcceptInvitationPage } from "../../src/features/team/pages/AcceptInvitationPage";

// ---------------------------------------------------------------------------
// La página del enlace de invitación: sin sesión ofrece crear la cuenta o
// entrar (y volver aquí); con sesión, «Unirme» entra a la empresa. Vencida,
// cancelada o inexistente, lo dice con palabras claras.
// ---------------------------------------------------------------------------

const auth = vi.hoisted(() => ({ value: { state: { status: "anonymous" as string }, signOut: async () => undefined } }));
const tenants = vi.hoisted(() => ({ selectTenant: vi.fn(), reload: vi.fn() }));

vi.mock("@shared/auth/context/AuthContext", () => ({ useAuth: () => auth.value }));
vi.mock("@shared/auth/tenant/ActiveTenantContext", () => ({ useActiveTenantOptional: () => tenants }));
vi.mock("@shared/ui/auth-layout/AuthLayout", () => ({
  AuthLayout: ({ title, subtitle, children }: { title: string; subtitle: string; children: unknown }) => (
    <main>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children as never}
    </main>
  )
}));

const TOKEN = "t".repeat(43);
const reply = (status: number, body?: unknown) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

const PREVIEW = { status: "pending", companyName: "Dilo Cantando", companyLogoUrl: null, inviterName: "Camilo", role: "operator", emailHint: "ma***@x.co", expiresAt: "2099-01-01T00:00:00.000Z" };

function stubApi(preview: unknown, previewStatus = 200) {
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    if (url.pathname === `/invitations/${TOKEN}`) return reply(previewStatus, preview);
    if (url.pathname === `/me/invitations/${TOKEN}/accept` && init?.method === "POST") return reply(200, { tenantId: "t-1", tenantName: "Dilo Cantando", role: "operator", joined: true });
    return reply(404, { message: "no" });
  }));
}

function Where() {
  const location = useLocation();
  return <span data-testid="where">{`${location.pathname}|${JSON.stringify(location.state)}`}</span>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/invite/${TOKEN}`]}>
      <Routes>
        <Route path="/invite/:token" element={<AcceptInvitationPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  tenants.selectTenant.mockClear();
  tenants.reload.mockClear();
  auth.value = { state: { status: "anonymous" }, signOut: async () => undefined };
});

describe("Página de invitación", () => {
  it("sin sesión: la empresa, quién invita y el rol; crear cuenta o entrar vuelven al enlace", async () => {
    stubApi(PREVIEW);
    renderPage();
    expect(await screen.findByRole("heading", { name: "Te invitaron a un equipo" })).toBeInTheDocument();
    expect(screen.getByText("Dilo Cantando")).toBeInTheDocument();
    expect(screen.getByText("Camilo te invitó a trabajar con su equipo en Auream.")).toBeInTheDocument();
    expect(screen.getByText("Asesor")).toBeInTheDocument();
    expect(screen.getByText("ma***@x.co")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "Crear mi cuenta" }));
    expect(screen.getByTestId("where")).toHaveTextContent(`/register|{"from":"/invite/${TOKEN}"}`);
  });

  it("con sesión: «Unirme» entra a la empresa y la deja elegida", async () => {
    auth.value = { state: { status: "authenticated" }, signOut: async () => undefined };
    stubApi(PREVIEW);
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Unirme a Dilo Cantando" }));
    expect(tenants.selectTenant).toHaveBeenCalledWith("t-1");
    expect(tenants.reload).toHaveBeenCalled();
    expect(screen.getByTestId("where")).toHaveTextContent("/conversations");
  });

  it("vencida, o que no existe, lo dice claro", async () => {
    stubApi({ ...PREVIEW, status: "expired" });
    const view = renderPage();
    expect(await screen.findByRole("heading", { name: "Esta invitación venció" })).toBeInTheDocument();
    view.unmount();

    stubApi({ message: "no" }, 404);
    renderPage();
    expect(await screen.findByRole("heading", { name: "Esta invitación no existe" })).toBeInTheDocument();
  });
});
