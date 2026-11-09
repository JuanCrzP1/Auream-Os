import { describe, expect, it, vi } from "vitest";
import { readPaymentProofConfig, type PaymentProofConfig } from "../../contracts/PaymentProofConfig.js";
import { sampleResolver } from "../../contracts/TemplateVariables.js";
import { extractReceipt } from "../../flow-engine/nodes/payment-proof/extractReceipt.js";
import { verifyReceipt } from "../../flow-engine/nodes/payment-proof/verifyReceipt.js";
import { detectDocumentType, runPaymentProofStep, type PaymentProofPorts } from "../../flow-engine/nodes/payment-proof/runPaymentProofStep.js";
import { PaymentProofNodeHandler } from "../../flow-engine/nodes/payment-proof/PaymentProofNodeHandler.js";
import { fold, nameAppears, textWords, withinOneEdit } from "../../flow-engine/nodes/payment-proof/receiptText.js";
import { zonedToInstant } from "../../flow-engine/values/zonedTime.js";
import { InMemoryReceiptRegistry } from "../../infrastructure/persistence/memory/InMemoryReceiptRegistry.js";
import { DisabledHttpRequester } from "../../infrastructure/http/DisabledHttpRequester.js";
import { simulationDependencies } from "../../apps/api/composition/composeNodeRuntime.js";
import { TestPaymentProofService } from "../../domains/automations/builder/application/TestPaymentProofService.js";
import { InMemoryRateLimiter } from "../../platform/security/rate-limiting/application/InMemoryRateLimiter.js";
import type { DocumentTextReader } from "../../flow-engine/ports/DocumentTextReader.js";
import type { MediaFetcher } from "../../flow-engine/ports/MediaFetcher.js";
import type { FlowNode } from "../../contracts/FlowSnapshot.js";
import type { RuntimeInput, Session } from "../../contracts/RuntimeContracts.js";

// ---------------------------------------------------------------------------
// Comprobante automático: del texto de un comprobante (como lo entrega el OCR,
// con sus errores) a la salida correcta, sin IA. Cubre comprobantes de varios
// países, cuentas enmascaradas, titulares con variantes, montos, antigüedad y
// repetidos, y que «Probar» nunca gaste un comprobante.
// ---------------------------------------------------------------------------

const NOW = new Date("2026-11-08T20:00:00Z"); // 3:00 p. m. en Bogotá
const TZ = "America/Bogota";

/** Como lo leyó el OCR (asteriscos convertidos en «e», espacios de columnas). */
const BANCOLOMBIA = `¡Transferencia exitosa!

Envío a otra cuenta

$ 149.900

Para                                            AUREAM SAS
Banco destino                                       Bancolombia
Cuenta de ahorros                                      e 4567
Fecha                                8 nov 2026, 10:35 a. m.
Referencia                                          M8743219
De                                                            Laura Gómez`;

const NEQUI = `Envío exitoso
¿Cuánto?
$ 50.000,00
Para
Aur*** Sas
Número Nequi
300 123 4567
Fecha
08 de noviembre de 2026 a las 02:10 p. m.
Referencia
M12345678`;

const SPEI = `Comprobante de transferencia SPEI
Monto: $1,250.50 MXN
Beneficiario: Auream México SA de CV
CLABE: 012180001234567891
Fecha de operación: 07/11/2026 18:45
Clave de rastreo: MBAN01002611070001
Ordenante: Pedro Ramírez`;

const PIX = `Comprovante de transferência
Pix enviado
Valor R$ 89,90
Para Auream Ltda
Chave pix pagos@auream.com.br
Data 08/11/2026 - 09:12
ID da transação E12345678202611081212abcdef`;

const account = (overrides: Record<string, unknown> = {}) => ({
  id: "a1",
  country: "CO",
  provider: "co-bancolombia",
  number: "123-456-74567",
  holder: "Auream S.A.S.",
  ...overrides
});

const config = (overrides: Record<string, unknown> = {}): PaymentProofConfig =>
  readPaymentProofConfig({ accounts: [account()], ...overrides });

const verify = (text: string, cfg: PaymentProofConfig, expectedAmount?: number) =>
  verifyReceipt(cfg, extractReceipt(text, TZ), { now: NOW, ...(expectedAmount !== undefined ? { expectedAmount } : {}) });

describe("texto del comprobante", () => {
  it("pliega tildes y mayúsculas sin cambiar la longitud", () => {
    expect(fold("Gómez ÁVILA")).toBe("gomez avila");
    expect(fold("Gómez ÁVILA")).toHaveLength("Gómez ÁVILA".length);
  });

  it("reconoce titulares con variantes, enmascarados y con errores del OCR", () => {
    expect(nameAppears("AUREAM S.A.S.", textWords(fold("Para AUREAM SAS")))).toBe(true);
    expect(nameAppears("Auream SAS", textWords(fold("Para Aur*** Sas")))).toBe(true);
    expect(nameAppears("Laura Gómez Pérez", textWords(fold("De Laura Gomes")))).toBe(true);
    expect(nameAppears("Auream SAS", textWords(fold("Para Distribuciones Lopez SAS")))).toBe(false);
    expect(withinOneEdit("gomez", "gomes")).toBe(true);
    expect(withinOneEdit("gomez", "lopez")).toBe(false);
  });

  it("convierte la hora del país del negocio a un instante", () => {
    expect(zonedToInstant({ year: 2026, month: 11, day: 8, hour: 10, minute: 35, second: 0 }, TZ).toISOString()).toBe("2026-11-08T15:35:00.000Z");
    expect(zonedToInstant({ year: 2026, month: 7, day: 1, hour: 12, minute: 0, second: 0 }, "Europe/Madrid").toISOString()).toBe("2026-07-01T10:00:00.000Z");
  });

  it("reconoce el tipo real del archivo por su firma", () => {
    expect(detectDocumentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "application/octet-stream")).toBe("image/jpeg");
    expect(detectDocumentType(new Uint8Array([0x25, 0x50, 0x44, 0x46]), "")).toBe("application/pdf");
    expect(detectDocumentType(new Uint8Array([1, 2, 3]), "audio/ogg; codecs=opus")).toBe("audio/ogg");
  });
});

describe("extractReceipt", () => {
  it("Bancolombia: valor, fecha con hora, referencia y pagador", () => {
    const facts = extractReceipt(BANCOLOMBIA, TZ);
    expect(facts.amount).toBe(149900);
    expect(facts.currency).toBeUndefined();
    expect(facts.date?.instant.toISOString()).toBe("2026-11-08T15:35:00.000Z");
    expect(facts.date?.local).toBe("2026-11-08 10:35");
    expect(facts.reference).toBe("M8743219");
    expect(facts.payer).toBe("Laura Gómez");
  });

  it("Nequi: valor en la línea siguiente al rótulo y fecha larga en p. m.", () => {
    const facts = extractReceipt(NEQUI, TZ);
    expect(facts.amount).toBe(50000);
    expect(facts.date?.local).toBe("2026-11-08 14:10");
    expect(facts.reference).toBe("M12345678");
  });

  it("SPEI (México): moneda explícita, fecha numérica y clave de rastreo", () => {
    const facts = extractReceipt(SPEI, "America/Mexico_City");
    expect(facts.amount).toBe(1250.5);
    expect(facts.currency).toBe("MXN");
    expect(facts.date?.local).toBe("2026-11-07 18:45");
    expect(facts.reference).toBe("MBAN01002611070001");
    expect(facts.payer).toBe("Pedro Ramírez");
  });

  it("PIX (Brasil): R$ y fecha dd/mm/aaaa", () => {
    const facts = extractReceipt(PIX, "America/Sao_Paulo");
    expect(facts.amount).toBe(89.9);
    expect(facts.currency).toBe("BRL");
    expect(facts.date?.local).toBe("2026-11-08 09:12");
  });

  it("no confunde números de cuenta, fechas ni horas con el valor", () => {
    const facts = extractReceipt("Pago exitoso\nCuenta 300 123 4567\nFecha 08/11/2026 10:35\nValor\n$ 20.000", TZ);
    expect(facts.amount).toBe(20000);
  });

  it("sin hora, la fecha vale hasta el final del día", () => {
    const facts = extractReceipt("Transferencia\nValor $ 10.000\nFecha 2026-11-08", TZ);
    expect(facts.date?.hasTime).toBe(false);
    expect(facts.date?.local).toBe("2026-11-08");
  });
});

describe("verifyReceipt", () => {
  it("válido: cuenta enmascarada con la entidad visible, titular y monto exacto", () => {
    const result = verify(BANCOLOMBIA, config({ amountCheck: "exact", expectedAmount: "149900" }), 149900);
    expect(result.output).toBe("valid");
    expect(result.bank).toBe("Bancolombia");
    expect(result.holder).toBe("Auream S.A.S.");
  });

  it("cuenta no registrada: el final visible no coincide", () => {
    expect(verify(BANCOLOMBIA, config({ accounts: [account({ number: "123-456-79999" })] })).output).toBe("wrong-key");
  });

  it("un final enmascarado sin entidad ni titular visibles NO basta", () => {
    const text = "Transferencia exitosa\nValor $ 10.000\nCuenta ****4567\nPara Otra Empresa";
    expect(verify(text, config({ matchHolder: false })).output).toBe("wrong-key");
  });

  it("celular completo con indicativo aunque el comprobante lo omita", () => {
    const cfg = config({ accounts: [account({ provider: "co-nequi", accountType: "wallet", number: "+57 300 123 4567", holder: "Auream SAS" })] });
    expect(verify(NEQUI, cfg).output).toBe("valid");
  });

  it("llaves y correos (PIX, Bre-B, alias) se buscan como texto", () => {
    const cfg = readPaymentProofConfig({
      accounts: [{ id: "br", country: "BR", provider: "other", number: "pagos@auream.com.br", holder: "Auream Ltda" }],
      amountCheck: "minimum",
      expectedAmount: "80",
      amountCurrency: "BRL"
    });
    expect(verifyReceipt(cfg, extractReceipt(PIX, "America/Sao_Paulo"), { now: NOW, expectedAmount: 80 }).output).toBe("valid");
  });

  it("titular incorrecto", () => {
    expect(verify(BANCOLOMBIA, config({ accounts: [account({ holder: "Comercializadora Andina" })] })).output).toBe("wrong-recipient");
  });

  it("los alias del titular también valen", () => {
    const cfg = config({ accounts: [account({ holder: "Auream Tecnología", holderAliases: ["AUREAM SAS"] })] });
    expect(verify(BANCOLOMBIA, cfg).output).toBe("valid");
  });

  it("monto: exacto, mínimo y moneda distinta", () => {
    expect(verify(BANCOLOMBIA, config({ amountCheck: "exact" }), 150000).output).toBe("wrong-amount");
    expect(verify(BANCOLOMBIA, config({ amountCheck: "minimum" }), 100000).output).toBe("valid");
    expect(verify(BANCOLOMBIA, config({ amountCheck: "minimum" }), 200000).output).toBe("wrong-amount");
    const usd = readPaymentProofConfig({ accounts: [account()], matchAccount: false, matchHolder: false, amountCheck: "minimum", amountCurrency: "USD" });
    const spei = verifyReceipt(usd, extractReceipt(SPEI, TZ), { now: NOW, expectedAmount: 10 });
    expect(spei.output).toBe("wrong-amount");
    expect(spei.checks.at(-1)?.detail).toMatch(/MXN/);
  });

  it("antigüedad: reciente, antiguo, sin fecha y fecha futura", () => {
    expect(verify(BANCOLOMBIA, config({ maxAgeEnabled: true, maxAgeHours: 24 })).output).toBe("valid");
    expect(verify(BANCOLOMBIA, config({ maxAgeEnabled: true, maxAgeHours: 1 })).output).toBe("too-old");
    expect(verify(BANCOLOMBIA.replace(/Fecha.*\n/, ""), config({ maxAgeEnabled: true })).output).toBe("too-old");
    expect(verify(BANCOLOMBIA.replace("8 nov 2026", "10 nov 2026"), config({ maxAgeEnabled: true })).output).toBe("too-old");
  });

  it("no es un comprobante: una foto con poco texto o sin datos de pago", () => {
    expect(verify("hola", config()).output).toBe("invalid");
    expect(verify("Menú del día\nSopa de verduras\nArroz con pollo", config()).output).toBe("invalid");
  });
});

describe("runPaymentProofStep", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
  const reader = (text: string): DocumentTextReader => ({ read: vi.fn(async () => ({ ok: true as const, text, method: "ocr" as const })) });
  const fetcher = (): MediaFetcher => ({
    fetch: vi.fn(async () => ({ ok: true as const, media: { bytes: png, contentType: "application/octet-stream" } }))
  });
  const ports = (text = BANCOLOMBIA, receipts = new InMemoryReceiptRegistry()): PaymentProofPorts => ({ fetcher: fetcher(), reader: reader(text), receipts });
  const input = (context: Record<string, unknown>, claim = true) => ({
    tenantId: "t",
    resolve: sampleResolver(context as Record<string, string>),
    now: NOW,
    timezone: TZ,
    ...(claim ? { claim: { conversationKey: "c", flowKey: "f" } } : {})
  });

  it("descarga el archivo de la variable (URL u objeto) y lee su tipo real", async () => {
    const p = ports();
    const resolve = (name: string) => (name === "comprobante" ? { url: "https://cdn.example.com/x", mimeType: "image/png" } : undefined);
    const result = await runPaymentProofStep(config(), { ...input({}), resolve }, p);
    expect(result.output).toBe("valid");
    expect(p.fetcher.fetch).toHaveBeenCalledWith(expect.objectContaining({ url: "https://cdn.example.com/x" }));
    expect(p.reader.read).toHaveBeenCalledWith({ bytes: png, contentType: "image/png" });
    expect(result.fields).toMatchObject({ valor: "149900", referencia: "M8743219", fecha: "2026-11-08 10:35", banco: "Bancolombia" });
  });

  it("sin archivo en la variable → Error, con el motivo", async () => {
    const result = await runPaymentProofStep(config(), input({}), ports());
    expect(result.output).toBe("failure");
    expect(result.failure).toBe("source_missing");
    expect(result.missingVariables).toEqual(["comprobante"]);
  });

  it("un audio o un archivo ilegible sale por «No es un comprobante»", async () => {
    const p = { ...ports(), reader: { read: async () => ({ ok: false as const, reason: "unsupported_type" as const, message: "No es imagen." }) } };
    const result = await runPaymentProofStep(config(), input({ comprobante: "https://cdn.example.com/a.ogg" }), p);
    expect(result.output).toBe("invalid");
  });

  it("un monto esperado que no es número → Error (configuración)", async () => {
    const result = await runPaymentProofStep(config({ amountCheck: "exact", expectedAmount: "{precio}" }), input({ comprobante: "https://x.co/a", precio: "gratis" }), ports());
    expect(result.output).toBe("failure");
    expect(result.failure).toBe("invalid_expected_amount");
  });

  it("el mismo comprobante dos veces → «Comprobante repetido»", async () => {
    const p = ports();
    const first = await runPaymentProofStep(config(), input({ comprobante: "https://x.co/a" }), p);
    const second = await runPaymentProofStep(config(), input({ comprobante: "https://x.co/a" }), p);
    expect([first.output, second.output]).toEqual(["valid", "duplicate"]);
  });

  it("un comprobante rechazado no se gasta", async () => {
    const receipts = new InMemoryReceiptRegistry();
    await runPaymentProofStep(config({ amountCheck: "exact", expectedAmount: "1" }), input({ comprobante: "https://x.co/a" }), ports(BANCOLOMBIA, receipts));
    expect(await receipts.exists("t", "ref:M8743219")).toBe(false);
  });

  it("«Probar» (sin claim) consulta pero no registra", async () => {
    const receipts = new InMemoryReceiptRegistry();
    const test = { ...input({}, false), document: { bytes: png, contentType: "image/png" } };
    expect((await runPaymentProofStep(config(), test, ports(BANCOLOMBIA, receipts))).output).toBe("valid");
    expect((await runPaymentProofStep(config(), test, ports(BANCOLOMBIA, receipts))).output).toBe("valid");
    await receipts.claim("t", { fingerprint: "ref:M8743219", conversationKey: "c", flowKey: "f" });
    expect((await runPaymentProofStep(config(), test, ports(BANCOLOMBIA, receipts))).output).toBe("duplicate");
  });

  it("sin «rechazar repetidos», el repetido sigue siendo válido", async () => {
    const p = ports();
    await runPaymentProofStep(config({ rejectDuplicates: false }), input({ comprobante: "https://x.co/a" }), p);
    expect((await runPaymentProofStep(config({ rejectDuplicates: false }), input({ comprobante: "https://x.co/a" }), p)).output).toBe("valid");
  });
});

describe("PaymentProofNodeHandler", () => {
  const runtimeInput: RuntimeInput = {
    envelope: { tenantId: "t", flowKey: "f", channel: "whatsapp", conversationKey: "c", userKey: "573001112233", messageId: "m1", payload: {}, receivedAt: NOW.toISOString() },
    sessionContext: { comprobante: "https://cdn.example.com/c.png" },
    isWaitingInput: false,
    now: NOW.toISOString(),
    timezone: TZ
  };
  const session = { id: "s1", tenantId: "t", context: {} } as unknown as Session;
  const node = (cfg: Record<string, unknown>) =>
    ({ id: "pp", type: "payment-proof", name: "Comprobante", content: {}, config: { accounts: [account()], ...cfg }, metadata: {} }) as unknown as FlowNode;
  const handler = (text: string) =>
    new PaymentProofNodeHandler(
      {
        fetcher: { fetch: async () => ({ ok: true as const, media: { bytes: new Uint8Array([0xff, 0xd8, 0xff]), contentType: "image/jpeg" } }) },
        reader: { read: async () => ({ ok: true as const, text, method: "ocr" as const }) },
        receipts: new InMemoryReceiptRegistry()
      },
      simulationDependencies().contacts
    );

  it("sale por «valid» y deja los datos en la conversación", async () => {
    const result = await handler(BANCOLOMBIA).execute(node({}), runtimeInput, session);
    expect(result.output).toBe("valid");
    expect(result.contextPatch).toMatchObject({ "comprobante.valor": "149900", "comprobante.referencia": "M8743219", "comprobante.nombre_pagador": "Laura Gómez" });
    expect(result.contextPatch["comprobante.error"]).toBeUndefined();
    expect(result.domainEvents).toContain("payment_proof_valid:pp");
  });

  it("si no es válido, guarda el motivo en la variable de error", async () => {
    const result = await handler(BANCOLOMBIA).execute(node({ amountCheck: "exact", expectedAmount: "99000" }), runtimeInput, session);
    expect(result.output).toBe("wrong-amount");
    expect(result.contextPatch["comprobante.error"]).toMatch(/se esperaban/);
  });

  it("la simulación sin lector de documentos sale por Error, sin detener el motor", async () => {
    const runtime = new PaymentProofNodeHandler(
      { fetcher: new DisabledHttpRequester(), reader: simulationDependencies().documents, receipts: new InMemoryReceiptRegistry() },
      simulationDependencies().contacts
    );
    const result = await runtime.execute(node({}), runtimeInput, session);
    expect(result.executionStatus).toBe("success");
    expect(result.output).toBe("failure");
  });
});

describe("TestPaymentProofService («Probar»)", () => {
  const tester = { test: vi.fn(async () => ({ output: "valid", message: "ok", checks: [], fields: {}, durationMs: 1, missingVariables: [] })) };
  const service = (max = 10) => new TestPaymentProofService(tester, new InMemoryRateLimiter(), { windowMs: 60_000, maxRequests: max });
  const file = { data: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64"), contentType: "image/png" };

  it("exige configuración y un archivo de imagen o PDF", async () => {
    await expect(service().execute("t", { file })).rejects.toThrow(/configuración/);
    await expect(service().execute("t", { config: {} })).rejects.toThrow(/Sube una imagen/);
    await expect(service().execute("t", { config: {}, file: { ...file, contentType: "audio/ogg" } })).rejects.toThrow(/imagen/);
    await expect(service().execute("t", { config: {}, file: { ...file, data: "no es base64!" } })).rejects.toThrow(/completo/);
  });

  it("rechaza archivos grandes y limita las pruebas por cuenta", async () => {
    const big = { data: Buffer.alloc(2_600_000).toString("base64"), contentType: "image/png" };
    await expect(service().execute("t", { config: {}, file: big })).rejects.toThrow(/MB/);
    const limited = service(1);
    await limited.execute("t", { config: {}, file });
    await expect(limited.execute("t", { config: {}, file })).rejects.toThrow(/Demasiadas pruebas/);
  });
});
