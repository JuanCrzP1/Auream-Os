import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FLOW, FOLDER, renderHub, stubApi } from "../helpers/automationsHub";

// ---------------------------------------------------------------------------
// B10: crear (el id lo da el servidor), duplicar, archivar/restaurar y
// «Mover a…» desde el menú de la tarjeta. La API falsa persiste de verdad, así
// que lo que el hub muestra después sale de recargar la lista.
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.restoreAllMocks();
});

async function openMenu(name: string) {
  await userEvent.click(await screen.findByRole("button", { name: `Acciones para ${name}` }));
}

const calls = (fetchMock: ReturnType<typeof vi.fn>, method: string, pattern: RegExp) =>
  fetchMock.mock.calls.filter(([url, init]) => ((init as RequestInit | undefined)?.method ?? "GET") === method && pattern.test(String(url)));

describe("crear", () => {
  it("la pide al servidor y abre el builder con el id que él decide", async () => {
    const { fetchMock } = stubApi({ flows: [FLOW] });
    renderHub();
    await userEvent.click(await screen.findByRole("button", { name: /^nueva$/i }));

    expect(await screen.findByTestId("builder-key")).toHaveTextContent("nuevo-2");
    expect(calls(fetchMock, "POST", /\/automations$/)).toHaveLength(1);
  });

  it("dentro de una carpeta, nace en ella", async () => {
    const { fetchMock } = stubApi({ flows: [{ ...FLOW, folderId: FOLDER.id }], folders: [FOLDER] });
    renderHub(`/automations/folders/${FOLDER.id}`);
    await userEvent.click(await screen.findByRole("button", { name: /^nueva$/i }));

    await screen.findByTestId("builder-key");
    const [, init] = calls(fetchMock, "POST", /\/automations$/)[0]!;
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ folderId: FOLDER.id });
  });
});

describe("duplicar", () => {
  it("crea la copia en el servidor y aparece en la lista", async () => {
    stubApi({ flows: [FLOW] });
    renderHub();
    await openMenu(FLOW.name);
    await userEvent.click(screen.getByRole("menuitem", { name: /duplicar/i }));

    expect(await screen.findByText(`${FLOW.name} (copia)`)).toBeInTheDocument();
  });
});

describe("archivar y restaurar", () => {
  it("archivar la saca de la vista normal y la deja en «Archivadas»; restaurar la devuelve", async () => {
    stubApi({ flows: [FLOW] });
    renderHub();
    await openMenu(FLOW.name);
    await userEvent.click(screen.getByRole("menuitem", { name: /archivar/i }));

    const toggle = await screen.findByRole("button", { name: /archivadas \(1\)/i });
    expect(screen.queryByText(FLOW.name)).not.toBeInTheDocument();

    await userEvent.click(toggle);
    expect(screen.getByText("Archivada")).toBeInTheDocument();
    await openMenu(FLOW.name);
    expect(screen.queryByRole("menuitem", { name: /^archivar$/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: /restaurar/i }));

    expect(await screen.findByText(FLOW.name)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /archivadas/i })).not.toBeInTheDocument();
  });
});

describe("mover a…", () => {
  it("elige carpeta en un diálogo y la mueve en el servidor", async () => {
    const { fetchMock } = stubApi({ flows: [FLOW], folders: [FOLDER] });
    renderHub();
    await openMenu(FLOW.name);
    await userEvent.click(screen.getByRole("menuitem", { name: /mover a/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /sin carpeta/i })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("button", { name: FOLDER.name }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await vi.waitFor(() => expect(calls(fetchMock, "PATCH", /\/folder$/)).toHaveLength(1));
    const [, init] = calls(fetchMock, "PATCH", /\/folder$/)[0]!;
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ folderId: FOLDER.id });
  });

  it("Escape cierra el diálogo sin mover nada", async () => {
    const { fetchMock } = stubApi({ flows: [FLOW], folders: [FOLDER] });
    renderHub();
    await openMenu(FLOW.name);
    await userEvent.click(screen.getByRole("menuitem", { name: /mover a/i }));
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(calls(fetchMock, "PATCH", /\/folder$/)).toHaveLength(0);
  });
});
