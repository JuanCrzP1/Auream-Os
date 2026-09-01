import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDebouncedValue } from "../../src/features/automations/builder/hooks/useDebouncedValue";
import { useDraftSync } from "../../src/features/automations/builder/hooks/useDraftSync";

// ---------------------------------------------------------------------------
// Comportamiento del autoguardado.
//
// Se prueba la composición real —debounce + sincronización— y no cada pieza por
// separado, porque el defecto que estos tests existen para impedir vivía justo
// en la costura: el cleanup del debounce anterior emitía por su cuenta y
// convertía el autoguardado en un guardado por pulsación.
//
// El borrador se representa como un objeto cualquiera: al sincronizador solo le
// importa que sea serializable, no que sea un snapshot de flujo.
// ---------------------------------------------------------------------------

const DELAY = 900;

interface Draft {
  text: string;
}

/** Monta la cadena completa tal y como la compone `useBuilderAutosave`. */
function renderAutosave(save: (draft: Draft) => Promise<void>, seedSignature: string | null = null) {
  return renderHook(
    ({ draft }: { draft: Draft | null }) => {
      const debounced = useDebouncedValue(draft, DELAY);
      return useDraftSync<Draft>({
        draft,
        debouncedDraft: debounced,
        seedSignature,
        enabled: true,
        save
      });
    },
    { initialProps: { draft: null as Draft | null } }
  );
}

/** Avanza el reloj dentro de `act` para que React procese lo que se dispare. */
async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

/** Cede el turno al microtask queue con temporizadores falsos activos. */
async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("autoguardado — temporización", () => {
  it("no guarda antes de que venza el debounce", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderAutosave(save);

    rerender({ draft: { text: "a" } });
    await advance(DELAY - 100);

    expect(save).not.toHaveBeenCalled();
  });

  it("guarda una sola vez cuando el usuario deja de escribir", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderAutosave(save);

    // Cuatro pulsaciones seguidas, ninguna separada por el debounce completo.
    for (const text of ["a", "ab", "abc", "abcd"]) {
      rerender({ draft: { text } });
      await advance(100);
    }
    await advance(DELAY);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ text: "abcd" });
  });

  it("no reenvía un borrador idéntico al último guardado", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderAutosave(save);

    rerender({ draft: { text: "a" } });
    await advance(DELAY);
    await flushPromises();

    // Mismo contenido, objeto distinto: debe reconocerse por firma.
    rerender({ draft: { text: "a" } });
    await advance(DELAY);

    expect(save).toHaveBeenCalledTimes(1);
  });

  it("no guarda nada si el borrador nunca cambia", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    renderAutosave(save, JSON.stringify({ text: "inicial" }));

    await advance(DELAY * 3);

    expect(save).not.toHaveBeenCalled();
  });
});

describe("autoguardado — estado real", () => {
  it("pasa por 'saving' y termina en 'saved' cuando la petición resuelve", async () => {
    // La petición se mantiene abierta a propósito: 'saving' solo es observable
    // mientras está en vuelo, y con una promesa ya resuelta el estado
    // intermedio se atravesaría dentro del mismo `act`.
    let resolveSave: (() => void) | null = null;
    const save = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveSave = resolve; })
    );
    const { result, rerender } = renderAutosave(save);

    expect(result.current).toBe("idle");

    rerender({ draft: { text: "a" } });
    await advance(DELAY);

    expect(result.current).toBe("saving");

    await act(async () => {
      resolveSave?.();
      await Promise.resolve();
    });
    await flushPromises();

    expect(result.current).toBe("saved");
  });

  it("marca 'error' y NO 'saved' cuando la petición falla", async () => {
    const save = vi.fn().mockRejectedValue(new Error("500"));
    const { result, rerender } = renderAutosave(save);

    rerender({ draft: { text: "a" } });
    await advance(DELAY);
    await flushPromises();

    expect(result.current).toBe("error");
  });

  it("reintenta tras un fallo: el cambio no se da por guardado", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValue(undefined);
    const { result, rerender } = renderAutosave(save);

    rerender({ draft: { text: "a" } });
    await advance(DELAY);
    await flushPromises();
    expect(result.current).toBe("error");

    rerender({ draft: { text: "ab" } });
    await advance(DELAY);
    await flushPromises();

    expect(result.current).toBe("saved");
    expect(save).toHaveBeenCalledTimes(2);
  });
});

describe("autoguardado — concurrencia", () => {
  it("no lanza una segunda petición mientras hay una en vuelo", async () => {
    let resolveFirst: (() => void) | null = null;
    const save = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        })
    );
    const { rerender } = renderAutosave(save);

    rerender({ draft: { text: "a" } });
    await advance(DELAY);
    expect(save).toHaveBeenCalledTimes(1);

    // Llega un cambio mientras la primera petición sigue abierta.
    rerender({ draft: { text: "ab" } });
    await advance(DELAY);

    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst?.();
      await Promise.resolve();
    });
    await flushPromises();

    expect(save).toHaveBeenCalledTimes(2);
  });

  it("al terminar envía solo el último cambio pendiente, no todos", async () => {
    let resolveFirst: (() => void) | null = null;
    const save = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        })
    );
    const { rerender } = renderAutosave(save);

    rerender({ draft: { text: "a" } });
    await advance(DELAY);

    for (const text of ["ab", "abc", "abcd"]) {
      rerender({ draft: { text } });
      await advance(DELAY);
    }

    await act(async () => {
      resolveFirst?.();
      await Promise.resolve();
    });
    await flushPromises();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({ text: "abcd" });
  });
});

describe("autoguardado — desmontaje", () => {
  it("vuelca el cambio pendiente al desmontar", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender, unmount } = renderAutosave(save);

    rerender({ draft: { text: "sin guardar" } });
    await advance(100); // el debounce aún no ha vencido

    expect(save).not.toHaveBeenCalled();

    unmount();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ text: "sin guardar" });
  });

  it("no vuelca nada al desmontar si no hay cambios sin guardar", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender, unmount } = renderAutosave(save);

    rerender({ draft: { text: "a" } });
    await advance(DELAY);
    await flushPromises();
    expect(save).toHaveBeenCalledTimes(1);

    unmount();

    expect(save).toHaveBeenCalledTimes(1);
  });
});
