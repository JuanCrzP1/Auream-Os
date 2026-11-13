import { describe, expect, it, vi } from "vitest";
import { SqlBusinessValues } from "../../infrastructure/persistence/sql/SqlBusinessData.js";

// ---------------------------------------------------------------------------
// Los Datos del negocio que lee el motor en cada turno: guardados unos
// segundos por cuenta (un turno no paga una consulta), olvidados en cuanto
// alguien los cambia en este servidor y, si la base falla, los últimos
// conocidos (un turno nunca se cae por esto).
// ---------------------------------------------------------------------------

describe("los valores que lee el motor", () => {
  it("se guardan unos segundos por cuenta, se olvidan al cambiarlos y, si la base falla, quedan los últimos", async () => {
    let now = 0;
    const list = vi.fn().mockResolvedValue([{ key: "g_horario", type: "text", value: "8 a 6" }]);
    const reader = new SqlBusinessValues({ list }, 15_000, () => now);
    await reader.values("t");
    await reader.values("t");
    expect(list).toHaveBeenCalledTimes(1);
    reader.forget("t");
    await reader.values("t");
    expect(list).toHaveBeenCalledTimes(2);
    now = 20_000;
    list.mockRejectedValueOnce(new Error("sin base"));
    expect(await reader.values("t")).toEqual({ g_horario: "8 a 6" });
  });
});
