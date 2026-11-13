import { describe, expect, it } from "vitest";
import { renderTemplate, sampleResolver, variablesIn } from "../../contracts/TemplateVariables.js";
import { templateResolver } from "../../flow-engine/templates/templateResolver.js";
import type { RuntimeInput } from "../../contracts/RuntimeContracts.js";
import type { ContactProfile } from "../../contracts/ContactContracts.js";

// ---------------------------------------------------------------------------
// Variables en plantillas: una sola sintaxis para builder y motor, y cada
// valor codificado según dónde cae.
// ---------------------------------------------------------------------------

const values: Record<string, unknown> = { full_name: "Ana \"La Jefa\" Pérez", city: "Bogotá D.C.", n: 3, ok: true, data: { a: 1 }, crlf: "x\r\nX-Evil: 1" };
const resolve = (name: string) => values[name];

describe("renderTemplate", () => {
  it("sustituye variables y deja el resto del texto intacto", () => {
    expect(renderTemplate("Hola {full_name}, ¿sigues en {city}? {n} {ok}", resolve).text).toBe("Hola Ana \"La Jefa\" Pérez, ¿sigues en Bogotá D.C.? 3 Sí");
  });

  it("a una persona le escribe como persona; a una máquina, crudo", () => {
    const typed = (name: string) => ({ ya: true, no: false, cumple: "1990-11-13", total: 1200000 })[name];
    expect(renderTemplate("{ya} {no} · {cumple} · {total}", typed).text).toBe("Sí No · 13/11/1990 · 1200000");
    expect(renderTemplate("{ya} {cumple}", typed, "raw").text).toBe("true 1990-11-13");
    expect(renderTemplate('{"ya":"{ya}","cumple":"{cumple}"}', typed, "json").text).toBe('{"ya":"true","cumple":"1990-11-13"}');
    expect(renderTemplate("?ya={ya}", typed, "url").text).toBe("?ya=true");
  });

  it("admite guiones en el nombre, como Leona: {resposta-lead}", () => {
    const r = renderTemplate("Recibí: {resposta-lead} · {sin-valor|nada}", (name) => (name === "resposta-lead" ? "https://blob/comprobante.jpg" : undefined));
    expect(r.text).toBe("Recibí: https://blob/comprobante.jpg · nada");
    expect(variablesIn("{resposta-lead} {comprobante.valor}")).toEqual(["resposta-lead", "comprobante.valor"]);
  });

  it("no toca llaves que no son variables (JSON)", () => {
    expect(renderTemplate('{"a": {"b": 1}, "c": {}}', resolve).text).toBe('{"a": {"b": 1}, "c": {}}');
  });

  it("las que no tienen valor quedan vacías y se informan una vez", () => {
    expect(renderTemplate("{nope}-{nope}-{city}", resolve)).toEqual({ text: "--Bogotá D.C.", missing: ["nope"] });
  });

  it("usa el valor por defecto si la variable falta o está vacía, y lo codifica igual", () => {
    expect(renderTemplate("Hola {nombre|amigo}, {city|x}", resolve)).toEqual({ text: "Hola amigo, Bogotá D.C.", missing: [] });
    expect(renderTemplate("Hola {vacio| cliente }", (n) => (n === "vacio" ? "" : undefined)).text).toBe("Hola cliente");
    expect(renderTemplate("?q={nada|San José}", resolve, "url").text).toBe("?q=San%20Jos%C3%A9");
    expect(variablesIn("{first_name|amigo}")).toEqual(["first_name"]);
  });

  it("admite el formato heredado {{context.clave}}", () => {
    expect(renderTemplate("Ciudad: {{ context.city }}", resolve).text).toBe("Ciudad: Bogotá D.C.");
  });

  it("codifica para URL, JSON y cabeceras", () => {
    expect(renderTemplate("?q={city}", resolve, "url").text).toBe("?q=Bogot%C3%A1%20D.C.");
    expect(JSON.parse(renderTemplate('{"n":"{full_name}"}', resolve, "json").text)).toEqual({ n: 'Ana "La Jefa" Pérez' });
    expect(renderTemplate("Bearer {crlf}", resolve, "header").text).toBe("Bearer x X-Evil: 1");
  });

  it("un objeto se inserta como JSON", () => {
    expect(renderTemplate("{data}", resolve).text).toBe('{"a":1}');
  });

  it("variablesIn lista las variables sin repetir", () => {
    expect(variablesIn("{a} {b} {a} {{context.c}}")).toEqual(["a", "b", "c"]);
  });

  it("sampleResolver da ejemplos de las del sistema y respeta lo que se pase", () => {
    const sample = sampleResolver({ phone: "57999" });
    expect(sample("full_name")).toBe("Laura Gómez");
    expect(sample("phone")).toBe("57999");
    expect(sample("otra")).toBeUndefined();
  });
});

describe("templateResolver (motor)", () => {
  const input = (context: Record<string, unknown> = {}, text = "hola"): RuntimeInput => ({
    envelope: { tenantId: "t", flowKey: "f", channel: "whatsapp", conversationKey: "c", userKey: "573001112233", messageId: "m", payload: { text }, receivedAt: "2026-11-08T00:00:00.000Z" },
    sessionContext: context,
    isWaitingInput: false,
    now: "2026-11-08T00:00:00.000Z",
    timezone: "UTC"
  });
  const profile: ContactProfile = { id: "c1", name: "Laura Gómez", phone: "573001112233", email: null, tags: [], fields: { ciudad: "Cali" } };

  it("variables del sistema desde el contacto y el mensaje", () => {
    const r = templateResolver(input(), profile);
    expect([r("first_name"), r("full_name"), r("phone"), r("last_message")]).toEqual(["Laura", "Laura Gómez", "573001112233", "hola"]);
  });

  it("lo que el cliente dijo en esta conversación manda; si no lo dijo, su ficha", () => {
    const r = templateResolver(input({ ciudad: "Lima", plan: "pro" }), profile);
    expect(r("ciudad")).toBe("Lima");
    expect(r("plan")).toBe("pro");
    // Un cliente que vuelve otro día (conversación en blanco): su ficha.
    expect(templateResolver(input(), profile)("ciudad")).toBe("Cali");
    // Una respuesta vacía no tapa la ficha.
    expect(templateResolver(input({ ciudad: "" }), profile)("ciudad")).toBe("Cali");
  });

  it("sin contacto, lo que guardó el flujo completa y el teléfono sale del canal", () => {
    const r = templateResolver(input({ full_name: "Pedro Ruiz" }), null);
    expect([r("first_name"), r("phone"), r("email")]).toEqual(["Pedro", "573001112233", undefined]);
  });
});
