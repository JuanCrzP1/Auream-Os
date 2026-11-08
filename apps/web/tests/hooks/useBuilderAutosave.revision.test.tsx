import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { RequestError } from "@shared/http/RequestError";
import type { BuilderFlowSnapshot } from "@contracts/FlowSnapshot";
import type { PersistedBuilderWorkspace } from "@contracts/BuilderContracts";

// ---------------------------------------------------------------------------
// Autoguardado con bloqueo optimista (C4): cada guardado dice sobre qué
// revisión se editó; un 409 detiene el autoguardado para no pisar trabajo ajeno.
// ---------------------------------------------------------------------------

const saveBuilderDraft = vi.fn<(flowKey: string, draft: BuilderFlowSnapshot, baseRevision: number) => Promise<PersistedBuilderWorkspace>>();
vi.mock("@features/automations/builder/services/saveBuilderDraft", () => ({
  saveBuilderDraft: (...args: Parameters<typeof saveBuilderDraft>) => saveBuilderDraft(...args)
}));

const { useBuilderAutosave } = await import("@features/automations/builder/hooks/builder/useBuilderAutosave");

const DELAY = 900;
const draft = (name: string) => ({ flow: { id: "f", key: "f", name } }) as unknown as BuilderFlowSnapshot;
const workspace = (revision: number, name: string) =>
  ({ tenantId: "t", flowKey: "f", draft: draft(name), updatedAt: "x", autosaveRevision: revision }) as PersistedBuilderWorkspace;

function mount(seedRevision = 3) {
  return renderHook(
    ({ current }: { current: BuilderFlowSnapshot }) =>
      useBuilderAutosave({ flowKey: "f", draft: current, seedSignature: JSON.stringify(draft("inicio")), seedRevision, enabled: true, onSaved: vi.fn() }),
    { initialProps: { current: draft("inicio") } }
  );
}

async function settle(ms = DELAY) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  saveBuilderDraft.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("autoguardado con revisión", () => {
  it("envía la revisión sobre la que se editó", async () => {
    saveBuilderDraft.mockResolvedValue(workspace(4, "uno"));
    const { rerender } = mount(3);

    rerender({ current: draft("uno") });
    await settle();

    expect(saveBuilderDraft).toHaveBeenCalledWith("f", draft("uno"), 3);
  });

  it("el siguiente guardado usa la revisión que devolvió el anterior, aunque salga en cola", async () => {
    let resolveFirst!: (ws: PersistedBuilderWorkspace) => void;
    saveBuilderDraft
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(workspace(5, "dos"));
    const { rerender } = mount(3);

    rerender({ current: draft("uno") });
    await settle();
    rerender({ current: draft("dos") }); // llega mientras el primero está en vuelo
    await settle();
    await act(async () => {
      resolveFirst(workspace(4, "uno"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(saveBuilderDraft).toHaveBeenNthCalledWith(2, "f", draft("dos"), 4);
  });

  it("un 409 pasa a «conflicto» y deja de guardar", async () => {
    saveBuilderDraft.mockRejectedValueOnce(new RequestError(409, "conflict"));
    const { result, rerender } = mount(3);

    rerender({ current: draft("uno") });
    await settle();
    expect(result.current).toBe("conflict");

    rerender({ current: draft("dos") });
    await settle();
    expect(saveBuilderDraft).toHaveBeenCalledTimes(1);
  });
});
