import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBuilderSimulation } from "../../src/features/automations/builder/hooks/builder/useBuilderSimulation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBotResponse(texts: string[]) {
  return {
    executionStatus: "waiting_input",
    outputMessages: texts.map((content) => ({ type: "text", content })),
    contextPatch: {},
    domainEvents: []
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useBuilderSimulation", () => {
  it("empieza con log vacío y estado idle", () => {
    const { result } = renderHook(() => useBuilderSimulation({ flowKey: "flow-test" }));

    expect(result.current.simulationLog).toHaveLength(0);
    expect(result.current.simulationStatus).toBe("idle");
  });

  it("añade mensaje de usuario al log al llamar handleSimulate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(makeBotResponse(["Hola, ¿cuál es tu nombre?"]))
      } as unknown as Response)
    );

    const { result } = renderHook(() => useBuilderSimulation({ flowKey: "flow-test" }));

    await act(async () => {
      await result.current.handleSimulate("Hola");
    });

    const userMsg = result.current.simulationLog.find((m) => m.role === "user");
    expect(userMsg?.content).toBe("Hola");
  });

  it("añade mensajes del bot al log tras respuesta exitosa", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(makeBotResponse(["Mensaje bot 1", "Mensaje bot 2"]))
      } as unknown as Response)
    );

    const { result } = renderHook(() => useBuilderSimulation({ flowKey: "flow-test" }));

    await act(async () => {
      await result.current.handleSimulate("test");
    });

    const botMessages = result.current.simulationLog.filter((m) => m.role === "bot");
    expect(botMessages).toHaveLength(2);
    expect(botMessages[0].content).toBe("Mensaje bot 1");
    expect(botMessages[1].content).toBe("Mensaje bot 2");
  });

  it("pone estado 'error' cuando el fetch falla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHook(() => useBuilderSimulation({ flowKey: "flow-test" }));

    await act(async () => {
      await result.current.handleSimulate("mensaje");
    });

    expect(result.current.simulationStatus).toBe("error");
  });

  it("resetSimulation limpia el log y vuelve a idle", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(makeBotResponse(["Hola"]))
      } as unknown as Response)
    );

    const { result } = renderHook(() => useBuilderSimulation({ flowKey: "flow-test" }));

    await act(async () => {
      await result.current.handleSimulate("test");
    });

    expect(result.current.simulationLog.length).toBeGreaterThan(0);

    act(() => {
      result.current.resetSimulation();
    });

    expect(result.current.simulationLog).toHaveLength(0);
    expect(result.current.simulationStatus).toBe("idle");
  });

  it("acumula mensajes de múltiples rondas de simulación", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(makeBotResponse(["¿Tu nombre?"]))
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(makeBotResponse(["Gracias, Ana."]))
        } as unknown as Response)
    );

    const { result } = renderHook(() => useBuilderSimulation({ flowKey: "flow-test" }));

    await act(async () => {
      await result.current.handleSimulate("hola");
    });
    await act(async () => {
      await result.current.handleSimulate("Ana");
    });

    const userMsgs = result.current.simulationLog.filter((m) => m.role === "user");
    const botMsgs = result.current.simulationLog.filter((m) => m.role === "bot");

    expect(userMsgs).toHaveLength(2);
    expect(botMsgs).toHaveLength(2);
  });
});
