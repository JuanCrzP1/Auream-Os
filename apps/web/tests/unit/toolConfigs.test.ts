import { describe, expect, it } from "vitest";
import { getTool, listPaletteTools } from "@features/automations/builder/tools/registry";
import { readTagsConfig } from "@features/automations/builder/tools/tags/tagsConfig";
import { readNotificationConfig } from "@features/automations/builder/tools/notification/notificationConfig";
import { readMenuConfig, MENU_OUTPUT } from "@features/automations/builder/tools/menu/menuConfig";
import { describeRule, readConditionConfig, createRule } from "@features/automations/builder/tools/conditional/conditionConfig";
import { readAiConfig, AI_OUTPUT } from "@features/automations/builder/tools/ai-extension/aiConfig";
import {
  PAYMENT_PROOF_OUTPUT,
  createAccount,
  readPaymentProofConfig
} from "@features/automations/builder/tools/payment-proof/paymentProofConfig";
import {
  DUPLICATE_ACCOUNT_MESSAGE,
  MISSING_HOLDER_MESSAGE,
  MISSING_NUMBER_MESSAGE,
  NO_ACCOUNTS_MESSAGE
} from "@features/automations/builder/tools/payment-proof/validatePaymentProof";
import { accountTypesFor, providersFor } from "@features/automations/builder/tools/payment-proof/paymentProviders";
import { COUNTRIES } from "@features/automations/builder/tools/_kit/catalogs";
import { INTEGRATION_OUTPUT } from "@features/automations/builder/tools/integration/integrationConfig";

const ids = (type: string, config: Record<string, unknown>) =>
  getTool(type)!.outputs!(config).map((output) => output.id);

describe("todas las herramientas de la paleta", () => {
  it("nacen con una configuración que su propio lector entiende y que resume sin fallar", () => {
    for (const tool of listPaletteTools()) {
      expect(() => tool.summarize?.({}, tool.defaultConfig), tool.type).not.toThrow();
      expect(() => tool.validate?.({}, tool.defaultConfig), tool.type).not.toThrow();
    }
  });

  it("toleran una configuración corrupta sin lanzar", () => {
    const corrupt = { options: "x", rules: 5, intents: null, headers: [null, 3], tags: {}, method: 9 };
    for (const tool of listPaletteTools()) {
      expect(() => tool.summarize?.({}, corrupt), tool.type).not.toThrow();
      expect(() => tool.validate?.({}, corrupt), tool.type).not.toThrow();
      expect(() => tool.outputs?.(corrupt), tool.type).not.toThrow();
    }
  });
});

describe("Etiquetas", () => {
  it("exige al menos una etiqueta y limpia vacías y repetidas", () => {
    expect(getTool("tags")!.validate!({}, { tags: [] }).valid).toBe(false);
    expect(readTagsConfig({ tags: [" vip ", "vip", "", 3] }).tags).toEqual(["vip"]);
    expect(getTool("tags")!.summarize!({}, { action: "remove", tags: ["a", "b"] })).toBe("Quitar: a, b");
  });
});

describe("Notificación", () => {
  it("normaliza el teléfono a dígitos y exige destinatario, número y mensaje", () => {
    expect(readNotificationConfig({ phone: "300 123-4567" }).phone).toBe("3001234567");
    const validate = getTool("notification")!.validate!;
    expect(validate({}, { name: "Ventas", phone: "123", message: "x" }).valid).toBe(false);
    expect(validate({}, { name: "Ventas", phone: "3001234567", message: "Nuevo lead" }).valid).toBe(true);
  });
});

describe("Pixel", () => {
  it("una compra exige valor; un lead no", () => {
    const validate = getTool("pixel")!.validate!;
    expect(validate({}, { connectionId: "p1", event: "lead" }).valid).toBe(true);
    expect(validate({}, { connectionId: "p1", event: "purchase" }).valid).toBe(false);
    expect(validate({}, { connectionId: "p1", event: "purchase", value: "{comprobante.valor}" }).valid).toBe(true);
  });

  it("usa un píxel de la cuenta, no un ID escrito en el bloque", () => {
    const validate = getTool("pixel")!.validate!;
    expect(validate({}, { pixelId: "123", event: "lead" }).valid).toBe(false);
  });
});

describe("Integración", () => {
  it("tiene salidas Éxito y Error y exige una URL http(s)", () => {
    expect(ids("integration", {})).toEqual([INTEGRATION_OUTPUT.success, INTEGRATION_OUTPUT.failure]);
    const validate = getTool("integration")!.validate!;
    expect(validate({}, { url: "ftp://x" }).valid).toBe(false);
    expect(validate({}, { url: "https://api.test/{phone}", headers: [] }).valid).toBe(true);
    expect(validate({}, { url: "https://api.test", headers: [{ id: "h", key: "", value: "x" }] }).valid).toBe(false);
  });
});

describe("Condicional", () => {
  it("sale por «Se cumple» o «No se cumple»", () => {
    expect(ids("condition", {})).toEqual(["true", "false"]);
  });

  it("al leer, corrige operadores que no pertenecen a la categoría", () => {
    const { rules } = readConditionConfig({ rules: [{ id: "r", category: "tag", operator: "greater_than", value: "vip" }] });
    expect(rules[0].operator).toBe("equal");
  });

  it("valida valores por categoría", () => {
    const validate = getTool("condition")!.validate!;
    expect(validate({}, { rules: [] }).valid).toBe(false);
    expect(validate({}, { rules: [{ ...createRule("a", "time"), value: "25:00" }] }).valid).toBe(false);
    expect(validate({}, { rules: [{ ...createRule("a", "messageWindow") }] }).valid).toBe(true);
    expect(validate({}, { rules: [{ ...createRule("a", "customField"), value: "x" }] }).valid).toBe(false);
  });

  it("describe una regla en una frase", () => {
    expect(describeRule({ ...createRule("a", "tag"), value: "vip" })).toBe("Etiqueta del contacto tiene vip");
  });
});

describe("Menú", () => {
  it("una salida por opción, más «Otra respuesta» y, con límite, «Tiempo agotado»", () => {
    const options = [
      { id: "o1", title: "Ventas" },
      { id: "o2", title: "Soporte" }
    ];
    expect(ids("menu", { options })).toEqual(["o1", "o2", MENU_OUTPUT.other]);
    expect(ids("menu", { options, timeoutEnabled: true })).toEqual(["o1", "o2", MENU_OUTPUT.other, MENU_OUTPUT.timeout]);
  });

  it("aplica los límites de WhatsApp por formato", () => {
    const validate = getTool("menu")!.validate!;
    const four = ["a", "b", "c", "d"].map((title) => ({ id: title, title }));
    expect(validate({}, { format: "buttons", message: "Hola", options: four }).valid).toBe(false);
    expect(validate({}, { format: "list", message: "Hola", buttonLabel: "Ver", options: four }).valid).toBe(true);
    expect(validate({}, { format: "list", message: "Hola", buttonLabel: "Ver", options: [{ id: "a", title: "x" }, { id: "b", title: "X" }] }).valid).toBe(false);
  });

  it("entiende el formato del stub anterior (opciones como texto)", () => {
    expect(readMenuConfig({ options: ["Ventas"] }).options[0].title).toBe("Ventas");
  });
});

describe("Extensión IA", () => {
  it("sin intenciones sale por Respuesta/Error; con ellas, una salida por intención + respaldo + error", () => {
    expect(ids("ai", {})).toEqual([AI_OUTPUT.success, AI_OUTPUT.failure]);
    expect(ids("ai", { intents: [{ id: "i1", description: "precios", key: "precios" }] })).toEqual([
      "i1",
      AI_OUTPUT.fallback,
      AI_OUTPUT.failure
    ]);
  });

  it("usa una conexión de la cuenta, no una clave en el bloque", () => {
    const read = readAiConfig({ provider: "gemini", apiKey: "sk-viejo", credentialId: "c1", model: "gemini-2.5-flash" });
    expect(read).toMatchObject({ credentialId: "c1", model: "gemini-2.5-flash" });
    expect(read).not.toHaveProperty("apiKey");
  });

  it("rechaza nombres de salida repetidos o con espacios", () => {
    const validate = getTool("ai")!.validate!;
    const intent = (id: string, key: string) => ({ id, description: "x", key });
    expect(validate({}, { intents: [intent("a", "precios"), intent("b", "Precios")] }).valid).toBe(false);
    expect(validate({}, { intents: [intent("a", "mal nombre")] }).valid).toBe(false);
    expect(validate({}, { credentialId: "c1", model: "m", intents: [intent("a", "precios")] }).valid).toBe(true);
    expect(validate({}, { model: "m", intents: [intent("a", "precios")] }).valid).toBe(false);
  });
});

describe("Comprobante automático", () => {
  const account = { id: "a1", country: "CO", provider: "co-nequi", accountType: "wallet", number: "3001234567", holder: "Auream SAS" };

  it("lo normal son dos salidas: válido y rechazado (como Leona), con cualquier verificación", () => {
    expect(ids("payment-proof", { splitRejections: false, matchAccount: true, matchHolder: true, amountCheck: "exact", maxAgeEnabled: true })).toEqual([
      PAYMENT_PROOF_OUTPUT.valid,
      PAYMENT_PROOF_OUTPUT.rejected
    ]);
    // Un bloque nuevo nace así.
    const tool = getTool("payment-proof")!;
    expect(tool.outputs!(tool.defaultConfig!).map((output) => output.id)).toEqual([PAYMENT_PROOF_OUTPUT.valid, PAYMENT_PROOF_OUTPUT.rejected]);
  });

  it("con «una salida por cada motivo» (y en bloques guardados antes) abre una por cada verificación activa", () => {
    const off = { matchAccount: false, matchHolder: false, rejectDuplicates: false };
    expect(ids("payment-proof", off)).toEqual([PAYMENT_PROOF_OUTPUT.valid, PAYMENT_PROOF_OUTPUT.invalid, PAYMENT_PROOF_OUTPUT.failure]);
    expect(
      ids("payment-proof", { matchAccount: true, matchHolder: true, amountCheck: "exact", maxAgeEnabled: true, rejectDuplicates: true })
    ).toEqual([
      PAYMENT_PROOF_OUTPUT.valid,
      PAYMENT_PROOF_OUTPUT.wrongAccount,
      PAYMENT_PROOF_OUTPUT.wrongHolder,
      PAYMENT_PROOF_OUTPUT.wrongAmount,
      PAYMENT_PROOF_OUTPUT.tooOld,
      PAYMENT_PROOF_OUTPUT.duplicate,
      PAYMENT_PROOF_OUTPUT.invalid,
      PAYMENT_PROOF_OUTPUT.failure
    ]);
  });

  it("exige cuentas completas cuando verifica cuenta o titular", () => {
    const validate = getTool("payment-proof")!.validate!;
    expect(validate({}, { accounts: [] }).reason).toBe(NO_ACCOUNTS_MESSAGE);
    expect(validate({}, { accounts: [{ ...account, number: "" }] }).reason).toBe(MISSING_NUMBER_MESSAGE);
    expect(validate({}, { accounts: [{ ...account, holder: " " }] }).reason).toBe(MISSING_HOLDER_MESSAGE);
    expect(validate({}, { accounts: [account] }).valid).toBe(true);
    expect(validate({}, { accounts: [account, { ...account, id: "a2" }] }).reason).toBe(DUPLICATE_ACCOUNT_MESSAGE);
  });

  it("verificar el monto exige el monto esperado", () => {
    const validate = getTool("payment-proof")!.validate!;
    expect(validate({}, { accounts: [account], amountCheck: "minimum" }).valid).toBe(false);
    expect(validate({}, { accounts: [account], amountCheck: "minimum", expectedAmount: "49900" }).valid).toBe(true);
  });

  it("migra el modelo anterior (una llave y un titular sueltos) a una cuenta", () => {
    const read = readPaymentProofConfig({ validateKey: true, expectedKey: "300", validateRecipient: false, expectedRecipient: "Juan" });
    expect(read.accounts).toHaveLength(1);
    expect(read.accounts[0]).toMatchObject({ number: "300", holder: "Juan", provider: "other" });
    expect(read.matchAccount).toBe(true);
    expect(read.matchHolder).toBe(false);
  });

  it("propone el tipo de cuenta habitual de cada entidad y país", () => {
    expect(createAccount("x", "CO", "co-nequi").accountType).toBe("wallet");
    expect(createAccount("x", "CO", "co-breb").accountType).toBe("key");
    expect(createAccount("x", "CO", "co-bancolombia").accountType).toBe("savings");
    expect(createAccount("x", "MX").accountType).toBe("clabe");
    expect(createAccount("x", "AR", "ar-mercadopago").accountType).toBe("cvu");
    expect(createAccount("x", "BR").accountType).toBe("pix");
    expect(createAccount("x", "PE", "pe-yape").accountType).toBe("wallet");
    expect(createAccount("x", "ES", "es-bizum").accountType).toBe("bizum");
  });

  it("cada país ofrece sus propias entidades y tipos, más «Otro»", () => {
    for (const country of COUNTRIES) {
      const providers = providersFor(country.code);
      expect(providers.length, country.code).toBeGreaterThan(1);
      expect(providers[providers.length - 1].id).toBe("other");
      expect(accountTypesFor(country.code).length, country.code).toBeGreaterThan(0);
      expect(new Set(providers.map((p) => p.id)).size).toBe(providers.length);
    }
  });

  it("entiende ids de entidad del modelo anterior y descarta tipos que no son del país", () => {
    const read = readPaymentProofConfig({ accounts: [{ id: "a", provider: "nequi", accountType: "clabe", number: "1" }] });
    expect(read.accounts[0]).toMatchObject({ country: "CO", provider: "co-nequi", accountType: "wallet" });
  });

  it("la moneda del monto, si no se eligió, es la del país de la primera cuenta", () => {
    expect(readPaymentProofConfig({ accounts: [{ ...account, country: "MX", provider: "mx-bbva" }] }).amountCurrency).toBe("MXN");
  });
});
