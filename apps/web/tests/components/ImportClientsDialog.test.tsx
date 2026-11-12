import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PipelineSummary } from "@contracts/CrmContracts";
import { ImportClientsDialog } from "../../src/features/crm/pipeline/ImportClientsDialog";

// «Traer clientes existentes»: dice cuántos son por periodo y los trae al tocar.

const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;
const PIPELINE: PipelineSummary = {
  id: "p1", name: "Ventas", stages: [{ id: "s1", labelId: "l1", name: "Nuevo", color: "#8b5cf6", outcome: "open", position: 0 } as never],
  entryStageId: "s1", saleStageId: null, defaultProductId: null, autoAssign: false, entrySource: "all"
};

describe("Traer clientes existentes", () => {
  it("cuenta por periodo y trae a los que faltan", async () => {
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(String(input), "http://api.test");
      if (init?.method === "POST") return reply(200, { count: 12, remaining: 0 });
      return reply(200, { count: url.searchParams.get("days") === "30" ? 12 : 40 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const onDone = vi.fn();
    render(<ImportClientsDialog pipeline={PIPELINE} justCreated onDone={onDone} onClose={() => undefined} />);

    expect(await screen.findByRole("status")).toHaveTextContent("12 clientes para traer");
    await userEvent.click(screen.getByRole("radio", { name: "Todos" }));
    expect(await screen.findByText("40")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Traer 40 clientes" }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({ days: null });
  });
});
