import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { CompanyResponse, MyProfileResponse } from "@contracts/AccountContracts";
import { AppearanceSettings } from "../../src/features/account/components/AppearanceSettings";
import { CompanySettings } from "../../src/features/account/components/CompanySettings";
import { ProfileSettings } from "../../src/features/account/components/ProfileSettings";
import { ThemeProvider } from "../../src/shared/theme/context/ThemeContext";

// ---------------------------------------------------------------------------
// Configuración → Mi perfil (foto, nombre, WhatsApp personal, correo, contraseña)
// y General (logo, nombre, zona horaria): lo que se guarda va a la API y se refleja en la
// cuenta compartida (la tarjeta de la barra lateral cambia al instante).
// ---------------------------------------------------------------------------

const api = vi.hoisted(() => ({
  updateMyProfile: vi.fn(),
  uploadProfilePhoto: vi.fn(),
  removeProfilePhoto: vi.fn(),
  updateCompany: vi.fn(),
  uploadCompanyLogo: vi.fn(),
  removeCompanyLogo: vi.fn()
}));
vi.mock("@shared/account/accountApi", async (original) => ({ ...(await original<object>()), ...api }));

const state = vi.hoisted(() => ({ profile: null as MyProfileResponse | null, company: null as CompanyResponse | null, setProfile: vi.fn(), setCompany: vi.fn() }));
vi.mock("@shared/account/AccountContext", () => ({
  useAccount: () => ({
    profile: state.profile,
    company: state.company,
    displayName: state.profile?.displayName ?? "Juan",
    email: "juan@example.com",
    setProfile: state.setProfile,
    setCompany: state.setCompany,
    reload: vi.fn(async () => undefined)
  })
}));

const COMPANY: CompanyResponse = { name: "Dilo Cantando", timezone: "America/Bogota", timezoneIsDefault: true, logoUrl: null, canEdit: true };

beforeEach(() => {
  vi.clearAllMocks();
  state.profile = { displayName: "Juan Camilo", phone: "+573001234567", photoUrl: null };
  state.company = COMPANY;
});

const page = (element: JSX.Element) => render(<MemoryRouter>{element}</MemoryRouter>);

describe("Configuración → Mi perfil", () => {
  it("muestra tus datos y guarda nombre y WhatsApp personal con su prefijo", async () => {
    api.updateMyProfile.mockResolvedValue({ displayName: "Juan C. Cruz", phone: "+573009998877", photoUrl: null });
    page(<ProfileSettings />);
    expect(screen.getByLabelText("Nombre completo")).toHaveValue("Juan Camilo");
    expect(screen.getByLabelText("WhatsApp personal")).toHaveValue("3001234567");

    await userEvent.clear(screen.getByLabelText("Nombre completo"));
    await userEvent.type(screen.getByLabelText("Nombre completo"), "Juan C. Cruz");
    await userEvent.clear(screen.getByLabelText("WhatsApp personal"));
    await userEvent.type(screen.getByLabelText("WhatsApp personal"), "300 999 8877");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(api.updateMyProfile).toHaveBeenCalledWith({ displayName: "Juan C. Cruz", phone: "+573009998877" }));
    expect(state.setProfile).toHaveBeenCalledWith({ displayName: "Juan C. Cruz", phone: "+573009998877", photoUrl: null });
    expect(await screen.findByText("Datos guardados.")).toBeInTheDocument();
  });

  it("sube la foto al elegirla y rechaza archivos que no son imagen sin subirlos", async () => {
    api.uploadProfilePhoto.mockResolvedValue({ displayName: "Juan Camilo", phone: null, photoUrl: "https://blob.example/p.png" });
    page(<ProfileSettings />);
    const input = screen.getByLabelText("Elegir foto");

    await userEvent.upload(input, new File(["x"], "foto.png", { type: "image/png" }));
    await waitFor(() => expect(state.setProfile).toHaveBeenCalledWith(expect.objectContaining({ photoUrl: "https://blob.example/p.png" })));

    await userEvent.upload(input, new File(["x"], "cv.pdf", { type: "application/pdf" }), { applyAccept: false });
    expect(await screen.findByText("La imagen debe ser JPG, PNG o WebP.")).toBeInTheDocument();
    expect(api.uploadProfilePhoto).toHaveBeenCalledTimes(1);
  });

  it("muestra el correo de acceso (sin editar: lo cambia soporte) y la contraseña debajo", async () => {
    page(<ProfileSettings />);
    expect(screen.getAllByText("juan@example.com").length).toBeGreaterThan(0);
    expect(screen.getByText(/no se cambia desde aquí/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cambiar correo" })).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Nueva contraseña"), "corta");
    expect(screen.getByRole("alert")).toHaveTextContent("al menos 8 caracteres");
    expect(screen.getByRole("button", { name: "Cambiar contraseña" })).toBeDisabled();
  });
});

describe("Configuración → General", () => {
  it("el dueño cambia nombre y zona horaria; avisa si usa la de la plataforma", async () => {
    api.updateCompany.mockResolvedValue({ ...COMPANY, name: "Dilo Cantando SAS", timezone: "America/Mexico_City", timezoneIsDefault: false });
    page(<CompanySettings />);
    expect(screen.getByText(/rige la de la plataforma/)).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Nombre de la empresa"));
    await userEvent.type(screen.getByLabelText("Nombre de la empresa"), "Dilo Cantando SAS");
    await userEvent.selectOptions(screen.getByLabelText("Zona horaria"), "America/Mexico_City");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(api.updateCompany).toHaveBeenCalledWith({ name: "Dilo Cantando SAS", timezone: "America/Mexico_City" }));
    expect(state.setCompany).toHaveBeenCalled();
  });

  it("quien no es dueño la ve sin poder cambiarla", () => {
    state.company = { ...COMPANY, canEdit: false };
    page(<CompanySettings />);
    expect(screen.getByLabelText("Nombre de la empresa")).toBeDisabled();
    expect(screen.getByLabelText("Zona horaria")).toBeDisabled();
    expect(screen.getByText("Solo el dueño de la cuenta puede cambiar estos datos.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subir logo" })).toBeDisabled();
  });
});

describe("Configuración → Apariencia", () => {
  it("elige el tema con vista previa (claro, oscuro o el del sistema) y lo guarda en el navegador", async () => {
    window.localStorage.clear();
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AppearanceSettings />
        </ThemeProvider>
      </MemoryRouter>
    );
    const system = screen.getByRole("radio", { name: /Sistema/ });
    await userEvent.click(system);
    expect(system).toHaveAttribute("aria-checked", "true");
    expect(window.localStorage.getItem("bots-ai-theme")).toBe("system");
  });
});
