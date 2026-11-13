import { describe, expect, it } from "vitest";
import { resolveSendAt } from "../../domains/conversations/domain/ScheduledMessage.js";
import { CHAT, AUTHOR, TEXT, chatOf, scheduledHarness } from "../helpers/scheduledMessagesFakes.js";

// ---------------------------------------------------------------------------
// Programar mensajes en un chat: la hora es la del NEGOCIO, de un minuto a 90
// días; se valida igual que una respuesta del asesor; tope por chat; solo un
// pendiente se edita; cancelar y descartar.
// ---------------------------------------------------------------------------

const NOW = new Date("2026-11-12T20:00:00.000Z"); // 3:00 p. m. en Bogotá
const TOMORROW_9 = { date: "2026-11-13", time: "09:00" };

describe("la hora de un mensaje programado", () => {
  it("se lee en la zona del negocio, no en la del servidor ni la del asesor", () => {
    expect(resolveSendAt(TOMORROW_9, "America/Bogota", NOW).toISOString()).toBe("2026-11-13T14:00:00.000Z");
    expect(resolveSendAt(TOMORROW_9, "Europe/Madrid", NOW).toISOString()).toBe("2026-11-13T08:00:00.000Z");
  });

  it("al menos un minuto adelante, hasta 90 días, y con fecha y hora reales", () => {
    expect(() => resolveSendAt({ date: "2026-11-12", time: "15:00" }, "America/Bogota", NOW)).toThrow("al menos un minuto");
    expect(() => resolveSendAt({ date: "2026-11-12", time: "14:00" }, "America/Bogota", NOW)).toThrow("al menos un minuto");
    expect(resolveSendAt({ date: "2026-11-12", time: "15:02" }, "America/Bogota", NOW).toISOString()).toBe("2026-11-12T20:02:00.000Z");
    expect(() => resolveSendAt({ date: "2027-02-11", time: "09:00" }, "America/Bogota", NOW)).toThrow("hasta 90 días");
    expect(() => resolveSendAt({ date: "2027-02-31", time: "09:00" }, "America/Bogota", NOW)).toThrow("fecha válida");
    expect(() => resolveSendAt({ date: "13/11/2026", time: "09:00" }, "America/Bogota", NOW)).toThrow("fecha válida");
    expect(() => resolveSendAt({ date: "2026-11-13", time: "25:00" }, "America/Bogota", NOW)).toThrow("hora válida");
    expect(() => resolveSendAt({}, "America/Bogota", NOW)).toThrow("fecha válida");
  });
});

describe("programar, editar y cancelar", () => {
  it("programa a nombre de quien lo deja, arma el despertador a su hora y responde con la zona del negocio", async () => {
    const h = scheduledHarness();
    const response = await h.service.schedule("t1", CHAT, { parts: TEXT, ...TOMORROW_9 }, AUTHOR);
    expect(response.timeZone).toBe("America/Bogota");
    expect(response.messages).toHaveLength(1);
    expect(response.messages[0]).toMatchObject({ conversationId: CHAT, sendAt: "2026-11-13T14:00:00.000Z", cancelIfReplied: true, status: "pending", authorId: AUTHOR, authorName: "Ana" });
    expect(h.armed).toEqual([{ id: response.messages[0]!.id, at: "2026-11-13T14:00:00.000Z" }]);
    expect(h.sent).toHaveLength(0);
    // Nada interno sale hacia la pantalla.
    expect(Object.keys(response.messages[0]!)).not.toEqual(expect.arrayContaining(["tenantId", "armedAt", "claimedAt"]));
  });

  it("valida igual que una respuesta del asesor: archivos solo por https, y algo que enviar", async () => {
    const h = scheduledHarness();
    await expect(h.service.schedule("t1", CHAT, { parts: [{ kind: "media", media: { type: "image", url: "javascript:alert(1)" } }], ...TOMORROW_9 }, AUTHOR)).rejects.toThrow("enlace válido");
    await expect(h.service.schedule("t1", CHAT, { parts: [{ kind: "text", text: "   " }], ...TOMORROW_9 }, AUTHOR)).rejects.toThrow("Escribe un mensaje");
    await expect(h.service.schedule("t1", CHAT, { parts: TEXT, ...TOMORROW_9, cancelIfReplied: "sí" }, AUTHOR)).rejects.toThrow("cancela");
    expect(h.repository.rows.size).toBe(0);
  });

  it("chat de otra cuenta, inexistente o con id raro: «no encontrada»; número eliminado: no se programa", async () => {
    const h = scheduledHarness();
    await expect(h.service.schedule("t2", CHAT, { parts: TEXT, ...TOMORROW_9 }, AUTHOR)).rejects.toThrow("Conversación no encontrada.");
    await expect(h.service.list("t1", "../x")).rejects.toThrow("Conversación no encontrada.");
    const gone = scheduledHarness({ chat: chatOf({ connectionDeleted: true }) });
    await expect(gone.service.schedule("t1", CHAT, { parts: TEXT, ...TOMORROW_9 }, AUTHOR)).rejects.toThrow("fue eliminado");
  });

  it("hasta 20 pendientes por chat", async () => {
    const h = scheduledHarness();
    for (let index = 0; index < 20; index += 1) await h.service.schedule("t1", CHAT, { parts: TEXT, ...TOMORROW_9 }, AUTHOR);
    await expect(h.service.schedule("t1", CHAT, { parts: TEXT, ...TOMORROW_9 }, AUTHOR)).rejects.toThrow("ya tiene 20");
  });

  it("editar: cambia texto, hora y aviso; re-arma el despertador solo si cambió la hora", async () => {
    const h = scheduledHarness();
    const id = (await h.service.schedule("t1", CHAT, { parts: TEXT, ...TOMORROW_9 }, AUTHOR)).messages[0]!.id;
    const edited = await h.service.update("t1", CHAT, id, { parts: [{ kind: "text", text: "Nuevo" }], cancelIfReplied: false });
    expect(edited.messages[0]).toMatchObject({ parts: [{ kind: "text", text: "Nuevo" }], cancelIfReplied: false, sendAt: "2026-11-13T14:00:00.000Z" });
    expect(h.armed).toHaveLength(1);
    await h.service.update("t1", CHAT, id, { date: "2026-11-13", time: "10:30" });
    expect(h.armed.at(-1)).toEqual({ id, at: "2026-11-13T15:30:00.000Z" });
    await expect(h.service.update("t1", CHAT, id, { time: "10:30" })).rejects.toThrow("fecha válida");
  });

  it("cancelar uno pendiente lo saca; uno de otro chat o ya cancelado «ya no existe»", async () => {
    const h = scheduledHarness();
    const id = (await h.service.schedule("t1", CHAT, { parts: TEXT, ...TOMORROW_9 }, AUTHOR)).messages[0]!.id;
    expect((await h.service.cancel("t1", CHAT, id)).messages).toEqual([]);
    await expect(h.service.cancel("t1", CHAT, id)).rejects.toThrow("ya no existe");
    await expect(h.service.update("t1", CHAT, id, { cancelIfReplied: false })).rejects.toThrow("ya no existe");
    const other = (await h.service.schedule("t1", CHAT, { parts: TEXT, ...TOMORROW_9 }, AUTHOR)).messages[0]!.id;
    await expect(h.service.cancel("t1", "c0c0c0c0-0000-4000-8000-000000000002", other)).rejects.toThrow("Conversación no encontrada.");
    await expect(h.service.cancel("t2", CHAT, other)).rejects.toThrow("Conversación no encontrada.");
  });
});
