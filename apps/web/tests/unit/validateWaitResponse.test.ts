import { describe, expect, it } from "vitest";
import {
  INVALID_TARGET_MESSAGE,
  CONTRADICTORY_WAIT_MESSAGE,
  MISSING_TIMEOUT_MESSAGE,
  INVALID_TIMEOUT_MESSAGE,
  INVALID_UNIT_MESSAGE,
  validateWaitResponse
} from "@features/automations/builder/tools/wait-response/validateWaitResponse";
import { getTool } from "@features/automations/builder/tools/registry";
import { WAIT_RESPONSE_DEFAULT_CONFIG } from "@contracts/WaitResponseConfig";

// ---------------------------------------------------------------------------
// ¿Puede guardarse esta espera?
//
// La decisión vive en un módulo PURO: sin React, sin editor, sin botón de
// guardar y sin lienzo. Por eso estas pruebas no montan nada — le pasan
// configuraciones y leen la respuesta.
//
// SEMÁNTICA, NO TEXTUAL: cada caso construye el DATO que se quiere rechazar. No
// se escribe en ningún control ni se lee ninguna etiqueta.
// ---------------------------------------------------------------------------

const sinContenido = {};

describe("configuraciones válidas", () => {
  it("la configuración por defecto se puede guardar", () => {
    expect(validateWaitResponse(sinContenido, { ...WAIT_RESPONSE_DEFAULT_CONFIG })).toEqual({
      valid: true,
      reason: null
    });
  });

  it("un nodo sin nada configurado se puede guardar", () => {
    // Espera sin límite es el estado por defecto y es ejecutable tal cual.
    expect(validateWaitResponse(sinContenido, {}).valid).toBe(true);
  });

  it("acepta un tiempo máximo en minutos", () => {
    expect(
      validateWaitResponse(sinContenido, {
        waitIndefinitely: false,
        timeout: { amount: 30, unit: "minutes" }
      }).valid
    ).toBe(true);
  });

  it("acepta un tiempo máximo en horas", () => {
    expect(
      validateWaitResponse(sinContenido, {
        waitIndefinitely: false,
        timeout: { amount: 2, unit: "hours" }
      }).valid
    ).toBe(true);
  });

  it("el mensaje previo es opcional: sin texto también se guarda", () => {
    expect(validateWaitResponse({}, { waitIndefinitely: true }).valid).toBe(true);
  });

  it("acepta los interruptores y la reacción en cualquier combinación", () => {
    expect(
      validateWaitResponse(sinContenido, {
        waitIndefinitely: true,
        groupMessages: true,
        replyToInbound: true,
        reaction: "👍"
      }).valid
    ).toBe(true);
  });

  it("acepta un destino con guion bajo y dígitos", () => {
    expect(validateWaitResponse(sinContenido, { targetKey: "ciudad_2" }).valid).toBe(true);
    // Con guion, como en Leona («resposta-lead»).
    expect(validateWaitResponse(sinContenido, { targetKey: "resposta-lead" }).valid).toBe(true);
  });

  it("acepta el destino escrito con prefijo context.", () => {
    expect(validateWaitResponse(sinContenido, { targetKey: "context.ciudad" }).valid).toBe(true);
  });
});

describe("coherencia entre «sin límite» y tiempo máximo", () => {
  it("rechaza tener las dos cosas a la vez", () => {
    expect(
      validateWaitResponse(sinContenido, {
        waitIndefinitely: true,
        timeout: { amount: 30, unit: "minutes" }
      })
    ).toEqual({ valid: false, reason: CONTRADICTORY_WAIT_MESSAGE });
  });

  it("rechaza quitar el «sin límite» sin decir cuánto se espera", () => {
    expect(validateWaitResponse(sinContenido, { waitIndefinitely: false })).toEqual({
      valid: false,
      reason: MISSING_TIMEOUT_MESSAGE
    });
  });
});

describe("tiempo máximo inválido", () => {
  const conLimite = (timeout: unknown) => ({ waitIndefinitely: false, timeout });

  it("rechaza cero y negativos", () => {
    for (const amount of [0, -1, -60]) {
      expect(validateWaitResponse(sinContenido, conLimite({ amount, unit: "minutes" }))).toEqual({
        valid: false,
        reason: INVALID_TIMEOUT_MESSAGE
      });
    }
  });

  it("rechaza decimales", () => {
    expect(
      validateWaitResponse(sinContenido, conLimite({ amount: 2.5, unit: "hours" })).reason
    ).toBe(INVALID_TIMEOUT_MESSAGE);
  });

  it("rechaza una cantidad que no es número", () => {
    expect(
      validateWaitResponse(sinContenido, conLimite({ amount: "30", unit: "minutes" })).reason
    ).toBe(INVALID_TIMEOUT_MESSAGE);
  });

  it("rechaza una unidad que la herramienta no ofrece", () => {
    for (const unit of ["seconds", "days", "weeks", "", null]) {
      expect(validateWaitResponse(sinContenido, conLimite({ amount: 30, unit })).reason).toBe(
        INVALID_UNIT_MESSAGE
      );
    }
  });
});

describe("destino donde guardar la respuesta", () => {
  it("rechaza un nombre que el contexto no podría resolver", () => {
    // `EdgeEvaluator` y las plantillas resuelven `session.context[x]`: un nombre
    // con espacios o puntos se escribiría bien y sería ilegible después.
    for (const targetKey of ["mi ciudad", "ciudad.principal", "2ciudad", "ciudad[0]", "-ciudad"]) {
      expect(validateWaitResponse(sinContenido, { targetKey })).toEqual({
        valid: false,
        reason: INVALID_TARGET_MESSAGE
      });
    }
  });

  it("un destino vacío es ausencia, no error", () => {
    expect(validateWaitResponse(sinContenido, { targetKey: "   " }).valid).toBe(true);
  });
});

describe("la herramienta declara esta validación", () => {
  it("el registry expone validate para Esperar respuesta", () => {
    const tool = getTool("question");

    expect(tool?.validate).toBeDefined();
    expect(tool?.validate?.({}, { waitIndefinitely: false })).toEqual({
      valid: false,
      reason: MISSING_TIMEOUT_MESSAGE
    });
  });

  it("lo que la herramienta declara por defecto es válido", () => {
    const tool = getTool("question");

    expect(tool?.validate?.({}, tool.defaultConfig).valid).toBe(true);
  });
});
