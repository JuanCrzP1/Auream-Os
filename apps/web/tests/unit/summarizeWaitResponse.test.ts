import { describe, expect, it } from "vitest";
import { summarizeWaitResponse } from "@features/automations/builder/tools/wait-response/summarizeWaitResponse";
import { getTool } from "@features/automations/builder/tools/registry";
import { summarizeNode } from "@features/automations/builder/services/summarizeNode";

// ---------------------------------------------------------------------------
// El resumen de una espera para la tarjeta cerrada.
//
// DERIVADO, nunca fuente de verdad: se calcula desde `config` en cada lectura.
// Lo que se fija aquí es que sea CORTO —dos datos como mucho— y que el servicio
// genérico del builder lo use en lugar de su propio apaño.
// ---------------------------------------------------------------------------

describe("summarizeWaitResponse", () => {
  it("sin límite y sin destino: una sola frase", () => {
    expect(summarizeWaitResponse({}, { waitIndefinitely: true })).toBe("Sin límite");
  });

  it("añade el campo destino cuando lo hay", () => {
    expect(summarizeWaitResponse({}, { waitIndefinitely: true, targetKey: "ciudad" })).toBe(
      "Sin límite · Guarda en ciudad"
    );
  });

  it("describe minutos y horas en plural", () => {
    expect(
      summarizeWaitResponse({}, { waitIndefinitely: false, timeout: { amount: 30, unit: "minutes" } })
    ).toBe("30 minutos");
    expect(
      summarizeWaitResponse({}, { waitIndefinitely: false, timeout: { amount: 3, unit: "hours" } })
    ).toBe("3 horas");
  });

  it("y en singular, sin decir «1 minutos»", () => {
    expect(
      summarizeWaitResponse({}, { waitIndefinitely: false, timeout: { amount: 1, unit: "minutes" } })
    ).toBe("1 minuto");
    expect(
      summarizeWaitResponse({}, { waitIndefinitely: false, timeout: { amount: 1, unit: "hours" } })
    ).toBe("1 hora");
  });

  it("combina espera y destino", () => {
    expect(
      summarizeWaitResponse(
        {},
        { waitIndefinitely: false, timeout: { amount: 45, unit: "minutes" }, targetKey: "correo" }
      )
    ).toBe("45 minutos · Guarda en correo");
  });

  it("NO enumera agrupar, citar ni reaccionar", () => {
    // La tarjeta cerrada es un resumen, no una copia del editor. Si mañana
    // alguien añade estos matices, este test lo dirá.
    const resumen = summarizeWaitResponse(
      {},
      {
        waitIndefinitely: true,
        groupMessages: true,
        replyToInbound: true,
        reaction: "👍",
        targetKey: "ciudad"
      }
    );

    expect(resumen).toBe("Sin límite · Guarda en ciudad");
    expect(resumen).not.toMatch(/agrupar|citar|reacc|👍/i);
  });

  it("NUNCA muestra el prefijo técnico `context.` al usuario", () => {
    // La clave se normaliza al leerla, así que las dos formas guardadas se
    // resumen igual y ninguna filtra `context.` a la interfaz.
    expect(summarizeWaitResponse({}, { waitIndefinitely: true, targetKey: "context.ciudad" })).toBe(
      "Sin límite · Guarda en ciudad"
    );
    expect(summarizeWaitResponse({}, { waitIndefinitely: true, targetKey: "ciudad" })).toBe(
      "Sin límite · Guarda en ciudad"
    );
  });

  it("una configuración corrupta se resume como espera sin límite", () => {
    expect(summarizeWaitResponse({}, { waitIndefinitely: false, timeout: "media hora" })).toBe(
      "Sin límite"
    );
  });
});

describe("integración con el resumen genérico del builder", () => {
  it("la herramienta declara summarize y el servicio genérico lo usa", () => {
    expect(getTool("question")?.summarize).toBeDefined();

    const { preview } = summarizeNode({
      id: "n1",
      type: "question",
      name: "Esperar respuesta",
      content: {},
      config: { waitIndefinitely: false, timeout: { amount: 15, unit: "minutes" }, targetKey: "ciudad" },
      metadata: {}
    });

    // Antes de declarar `summarize`, el apaño genérico decía «Guarda en ciudad»
    // y se callaba la espera. Ahora manda la herramienta.
    expect(preview).toBe("15 minutos · Guarda en ciudad");
  });
});
