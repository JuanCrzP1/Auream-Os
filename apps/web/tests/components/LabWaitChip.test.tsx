import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { LabWaitChip } from "../../src/features/automations/builder/lab/LabWaitChip";
import { formatRemaining } from "../../src/features/automations/builder/lab/labModel";

// ---------------------------------------------------------------------------
// Las esperas del laboratorio siguen SOLAS justo a la hora, duren lo que duren
// (antes, una de más de un minuto se quedaba quieta para siempre), corrigiendo
// la diferencia entre el reloj del servidor y el de este equipo.
// ---------------------------------------------------------------------------

const NOW = Date.parse("2026-11-09T21:11:00.000Z");
const wait = (inMs: number) => ({ reason: "resume" as const, nodeId: "programador", revision: 3, until: new Date(NOW + inMs).toISOString() });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("espera del laboratorio", () => {
  it("una espera de 4 minutos cuenta el tiempo y sigue sola justo a la hora (una sola vez)", () => {
    const onContinue = vi.fn();
    render(<LabWaitChip wait={wait(4 * 60_000)} clockOffsetMs={0} blockName="Programador" onContinue={onContinue} />);
    expect(screen.getByText(/«Programador» continúa en 4 min/)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(80_000));
    expect(screen.getByText(/continúa en 2 min 40 s/)).toBeInTheDocument();
    expect(onContinue).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(160_000 - 1));
    expect(onContinue).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onContinue).toHaveBeenCalledWith(true);
    act(() => vi.advanceTimersByTime(10_000));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("corrige el reloj: sigue a la hora del SERVIDOR aunque este equipo vaya adelantado o atrasado", () => {
    // Este equipo va 30 s adelantado (servidor = equipo − 30 s): la hora del servidor llega 30 s DESPUÉS en este reloj.
    const ahead = vi.fn();
    const first = render(<LabWaitChip wait={wait(60_000)} clockOffsetMs={-30_000} blockName="Pausa" onContinue={ahead} />);
    act(() => vi.advanceTimersByTime(89_999));
    expect(ahead).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(ahead).toHaveBeenCalledWith(true);
    first.unmount();

    // Este equipo va 30 s atrasado: llega 30 s ANTES en este reloj.
    vi.setSystemTime(NOW);
    const behind = vi.fn();
    render(<LabWaitChip wait={wait(60_000)} clockOffsetMs={30_000} blockName="Pausa" onContinue={behind} />);
    act(() => vi.advanceTimersByTime(30_000));
    expect(behind).toHaveBeenCalledWith(true);
  });

  it("al volver a la pestaña revisa la hora enseguida; «Adelantar espera» sigue sin esperar", () => {
    const late = vi.fn();
    const hidden = render(<LabWaitChip wait={wait(5_000)} clockOffsetMs={0} blockName="Pausa" onContinue={late} />);
    vi.setSystemTime(NOW + 6_000);
    act(() => {
      fireEvent(document, new Event("visibilitychange"));
    });
    expect(late).toHaveBeenCalledWith(true);
    hidden.unmount();

    const manual = vi.fn();
    render(<LabWaitChip wait={wait(2 * 3_600_000)} clockOffsetMs={0} blockName="Programador" onContinue={manual} />);
    fireEvent.click(screen.getByRole("button", { name: "Adelantar espera" }));
    expect(manual).toHaveBeenCalledWith(false);
  });

  it("escribe el tiempo que falta en claro", () => {
    expect([formatRemaining(18_000), formatRemaining(200_000), formatRemaining(180_000), formatRemaining(7_500_000)]).toEqual(["18 s", "3 min 20 s", "3 min", "2 h 5 min"]);
  });
});
