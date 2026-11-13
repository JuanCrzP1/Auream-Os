import { describe, expect, it } from "vitest";
import { describe as describeSignal } from "../../domains/notifications/domain/Signal.js";
import { describeFlowFailure } from "../../domains/notifications/domain/flowFailure.js";
import { notificationViewer } from "../../apps/api/routes/routeNotificationsRequest.js";
import { makeContext } from "../security/helpers/access.js";
import type { Scope } from "../../platform/authorization/contracts/Scope.js";

// ---------------------------------------------------------------------------
// «Un flujo falló»: los bloques que fallan (Píxel, Integración, IA, Registrar
// venta) no detienen el flujo y dejan su evento en el historial de turnos. La
// campana lo dice en palabras del negocio y lleva al flujo. Nunca en silencio.
// ---------------------------------------------------------------------------

const none = { error: null, sendFailures: 0 };

describe("Falla de un flujo", () => {
  it("dice qué bloque falló y por qué, con palabras del negocio", () => {
    expect(describeFlowFailure({ event: "pixel_failed:n1:not_configured", ...none })).toBe("El Píxel no envió el evento a Meta: el bloque no tiene píxel elegido.");
    expect(describeFlowFailure({ event: "pixel_failed:n1:invalid_token", ...none })).toBe("El Píxel no envió el evento a Meta: el token ya no sirve; vuelve a guardarlo.");
    expect(describeFlowFailure({ event: "integration_failed:api:http_error", ...none })).toBe("La Integración falló: el servicio respondió con un error.");
    expect(describeFlowFailure({ event: "ai_failed:ia:quota_exceeded", ...none })).toBe("La Extensión IA no respondió: se acabó el saldo o el cupo del servicio.");
    expect(describeFlowFailure({ event: "sale_failed:v:product_missing", ...none })).toBe("Registrar venta no guardó la venta.");
  });

  it("sin evento de bloque: mensajes que WhatsApp no aceptó o un error interno", () => {
    expect(describeFlowFailure({ event: null, error: null, sendFailures: 1 })).toBe("WhatsApp no aceptó un mensaje del flujo.");
    expect(describeFlowFailure({ event: null, error: null, sendFailures: 3 })).toBe("WhatsApp no aceptó 3 mensajes del flujo.");
    expect(describeFlowFailure({ event: null, error: "boom", sendFailures: 0 })).toBe("El flujo se detuvo por un error interno.");
    expect(describeFlowFailure({ event: "raro_failed:x:algo", ...none })).toBe("Un bloque falló.");
  });

  it("el aviso cuenta las veces en 24 h y lleva al flujo", () => {
    const notice = describeSignal({ kind: "flow_failures", flowKey: "ventas key", flow: "Ventas VE", count: 5, last: { event: "pixel_failed:n1:not_configured", ...none }, at: new Date("2026-11-13T06:00:00Z") });
    expect(notice).toEqual({
      id: "flow:ventas key",
      title: "«Ventas VE» falló 5 veces en 24 h",
      detail: "El Píxel no envió el evento a Meta: el bloque no tiene píxel elegido.",
      path: "/builder/ventas%20key"
    });
    expect(describeSignal({ kind: "flow_failures", flowKey: "k", flow: "Uno", count: 1, last: { event: null, error: "x", sendFailures: 0 }, at: new Date() }).title).toBe("«Uno» falló 1 vez en 24 h");
  });

  it("lo ve quien ve flujos y chats; una clave de máquina con permiso de flujos no", () => {
    const kinds = (scopes: Scope[]) => notificationViewer(makeContext({ scopes, tenantId: "t", actorId: "u" })).kinds;
    expect(kinds(["flows.read", "conversations.read"]).has("flow_failures")).toBe(true);
    expect(kinds(["flows.read", "flows.write"]).has("flow_failures")).toBe(false);
    expect(kinds(["conversations.read"]).has("flow_failures")).toBe(false);
  });
});
