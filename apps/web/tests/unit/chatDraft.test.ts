import { describe, expect, it } from "vitest";
import type { QuickReply } from "@contracts/QuickReplyContracts";
import { applyQuickReply, fillVariables, toParts } from "../../src/features/conversations/components/composer/draft";
import { copyShortcut, groupByCategory, matchQuickReplies } from "../../src/features/conversations/quick-replies/quickReplyText";
import { threadView } from "../../src/features/conversations/components/threadView";
import { msg } from "../helpers/conversationsApi";

const reply = (shortcut: string, pieces: QuickReply["pieces"], category: string | null = null): QuickReply => ({ id: shortcut, shortcut, category, pieces, useCount: 0, lastUsedAt: null, createdAt: "", updatedAt: "" });

describe("borrador del compositor", () => {
  it("{nombre} es el primer nombre; sin nombre se quita con su espacio", () => {
    expect(fillVariables("Hola {nombre}, ¿qué tal?", "Laura Gómez")).toBe("Hola Laura, ¿qué tal?");
    expect(fillVariables("Hola {nombre}, ¿qué tal?", null)).toBe("Hola, ¿qué tal?");
  });

  it("un solo texto va al cuadro; varias piezas quedan en espera y salen antes del texto escrito", () => {
    expect(applyQuickReply(reply("a", [{ kind: "text", text: "Hola {nombre}" }]), "Ana")).toEqual({ text: "Hola Ana", pieces: [] });
    const applied = applyQuickReply(reply("b", [{ kind: "text", text: "Mira" }, { kind: "media", media: { type: "image", url: "https://x/a.png" }, caption: "Para {nombre}" }]), "Ana");
    expect(toParts(applied.pieces, " ¿Te gusta? ")).toEqual([
      { kind: "text", text: "Mira" },
      { kind: "media", media: { type: "image", url: "https://x/a.png" }, caption: "Para Ana" },
      { kind: "text", text: "¿Te gusta?" }
    ]);
  });

  it("busca primero por atajo y luego por contenido, sin importar tildes", () => {
    const replies = [reply("envios", [{ kind: "text", text: "Hacemos envíos" }]), reply("precios", [{ kind: "text", text: "Envío gratis" }])];
    expect(matchQuickReplies(replies, "envi").map((item) => item.shortcut)).toEqual(["envios", "precios"]);
  });
});

describe("catálogo de respuestas rápidas", () => {
  it("agrupa por categoría en orden alfabético, «Sin categoría» al final", () => {
    const groups = groupByCategory([reply("a", [], null), reply("b", [], "Precios"), reply("c", [], "Envíos"), reply("d", [], "Precios")]);
    expect(groups.map((group) => [group.category, group.replies.length])).toEqual([["Envíos", 1], ["Precios", 2], ["Sin categoría", 1]]);
  });

  it("la copia toma un atajo libre", () => {
    expect(copyShortcut("saludo", ["saludo"])).toBe("saludo-copia");
    expect(copyShortcut("saludo", ["saludo", "saludo-copia", "saludo-copia-2"])).toBe("saludo-copia-3");
  });
});

describe("hilo con reacciones", () => {
  it("la reacción del equipo cuelga de su mensaje (la última manda; vacía la quita)", () => {
    const target = msg({ text: "Hola" });
    const quote = { id: target.id, author: target.author, kind: target.kind, text: target.text };
    const like = msg({ direction: "outbound", author: "agent", kind: "reaction", text: "👍", status: "sent", replyTo: quote });
    const heart = msg({ direction: "outbound", author: "agent", kind: "reaction", text: "❤️", status: "sent", replyTo: quote });
    expect(threadView([target, like, heart])).toEqual({ messages: [target], reactions: new Map([[target.id, "❤️"]]) });
    const removed = msg({ direction: "outbound", author: "agent", kind: "reaction", text: "", status: "sent", replyTo: quote });
    expect(threadView([target, like, removed]).reactions.size).toBe(0);
  });
});
