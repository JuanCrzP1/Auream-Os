import { describe, it, expect } from "vitest";
import { selectHubContents } from "@features/automations/list/services/selectHubContents";
import type { AutomationFolderSummary, AutomationSummary } from "@contracts/AutomationContracts";

// ---------------------------------------------------------------------------
// QUÉ SE VE SEGÚN DÓNDE ESTÉ EL USUARIO.
//
// Es la regla que convierte una carpeta en un contenedor de verdad y no en un
// contador: en la raíz solo lo que no está guardado en ninguna, y dentro solo
// lo suyo. Se prueba aparte porque es la misma regla para las dos vistas —si
// viviera en el componente habría dos copias y dos sitios donde equivocarse—.
// ---------------------------------------------------------------------------

const flujo = (id: string, name: string, folderId?: string): AutomationSummary => ({
  id,
  key: id,
  name,
  status: "draft",
  ...(folderId !== undefined ? { folderId } : {}),
  updatedAt: "2026-01-01T00:00:00.000Z"
});

const carpeta = (id: string, name: string): AutomationFolderSummary => ({ id, name });

const VENTAS = carpeta("c1", "Ventas");
const SOPORTE = carpeta("c2", "Soporte");
const CARPETAS = [VENTAS, SOPORTE];

const FLUJOS = [
  flujo("f1", "Suelto uno"),
  flujo("f2", "Suelto dos"),
  flujo("f3", "De ventas", "c1"),
  flujo("f4", "Otro de ventas", "c1"),
  flujo("f5", "De soporte", "c2")
];

const nombres = (lista: ReadonlyArray<{ name: string }>) => lista.map((x) => x.name);

describe("la raíz solo muestra lo que no está en ninguna carpeta", () => {
  it("deja fuera las automatizaciones guardadas en carpetas", () => {
    const vista = selectHubContents(FLUJOS, CARPETAS, { folderId: null }, "");

    expect(nombres(vista.flows)).toEqual(["Suelto uno", "Suelto dos"]);
  });

  it("una automatización movida a una carpeta desaparece de la raíz", () => {
    const movida = FLUJOS.map((f) => (f.id === "f1" ? flujo("f1", "Suelto uno", "c1") : f));

    const vista = selectHubContents(movida, CARPETAS, { folderId: null }, "");

    expect(nombres(vista.flows)).toEqual(["Suelto dos"]);
  });

  it("en la raíz se ven todas las carpetas, y ninguna está abierta", () => {
    const vista = selectHubContents(FLUJOS, CARPETAS, { folderId: null }, "");

    expect(nombres(vista.folders)).toEqual(["Ventas", "Soporte"]);
    expect(vista.currentFolder).toBeNull();
  });
});

describe("una carpeta abierta solo muestra lo suyo", () => {
  it("lista sus automatizaciones y ninguna más", () => {
    const vista = selectHubContents(FLUJOS, CARPETAS, { folderId: "c1" }, "");

    expect(nombres(vista.flows)).toEqual(["De ventas", "Otro de ventas"]);
    expect(vista.currentFolder?.name).toBe("Ventas");
  });

  it("no se ofrece a sí misma como destino: solo las demás", () => {
    const vista = selectHubContents(FLUJOS, CARPETAS, { folderId: "c1" }, "");

    expect(nombres(vista.folders)).toEqual(["Soporte"]);
  });

  it("una carpeta sin nada dentro se declara vacía", () => {
    const vista = selectHubContents(FLUJOS, [...CARPETAS, carpeta("c3", "Nueva")], { folderId: "c3" }, "");

    expect(vista.flows).toHaveLength(0);
    expect(vista.isEmpty).toBe(true);
  });

  it("una carpeta que ya no existe no rompe la vista", () => {
    const vista = selectHubContents(FLUJOS, CARPETAS, { folderId: "borrada" }, "");

    expect(vista.currentFolder).toBeNull();
    expect(vista.flows).toHaveLength(0);
  });
});

describe("el recuento de cada carpeta", () => {
  it("cuenta lo que contiene, esté donde esté el usuario", () => {
    const raiz = selectHubContents(FLUJOS, CARPETAS, { folderId: null }, "");

    expect(raiz.countByFolder.get("c1")).toBe(2);
    expect(raiz.countByFolder.get("c2")).toBe(1);
  });

  it("una búsqueda no cambia cuántas contiene una carpeta", () => {
    // El recuento describe la carpeta, no el filtro que el usuario escribió.
    const vista = selectHubContents(FLUJOS, CARPETAS, { folderId: null }, "no existe nada así");

    expect(vista.flows).toHaveLength(0);
    expect(vista.countByFolder.get("c1")).toBe(2);
  });
});

describe("la búsqueda actúa dentro de la ubicación, no sobre todo", () => {
  it("en la raíz busca solo entre las sueltas", () => {
    const vista = selectHubContents(FLUJOS, CARPETAS, { folderId: null }, "ventas");

    // «De ventas» existe, pero está en una carpeta: aquí no se busca.
    expect(vista.flows).toHaveLength(0);
  });

  it("dentro de una carpeta busca solo entre las suyas", () => {
    const vista = selectHubContents(FLUJOS, CARPETAS, { folderId: "c1" }, "otro");

    expect(nombres(vista.flows)).toEqual(["Otro de ventas"]);
  });
});
