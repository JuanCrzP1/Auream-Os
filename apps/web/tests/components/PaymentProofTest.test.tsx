import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentProofEditor } from "@features/automations/builder/tools/payment-proof/PaymentProofEditor";
import type { ToolDraft } from "@features/automations/builder/tools/ToolUi";
import type { ToolResources } from "@features/automations/builder/tools/ToolResources";
import type { PaymentProofTestResult } from "@contracts/PaymentProofTestContracts";

// ---------------------------------------------------------------------------
// «Probar» del Comprobante: se sube un comprobante de ejemplo y se ve la
// salida, cada verificación y los datos leídos (la cuenta, enmascarada).
// ---------------------------------------------------------------------------

const ACCOUNT = { id: "a1", country: "CO", provider: "co-bancolombia", number: "123-456-74567", holder: "Auream SAS" };

function Editor({ resources, config = {} }: { resources: ToolResources; config?: Record<string, unknown> }) {
  const [draft, setDraft] = useState<ToolDraft>({ name: "Comprobante", content: {}, config: { accounts: [ACCOUNT], ...config } });
  return <PaymentProofEditor draft={draft} resources={resources} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }) as ToolDraft)} />;
}

const RESULT: PaymentProofTestResult = {
  output: "wrong-amount",
  message: "Se pagó $ 149.900; se esperaban $ 150.000.",
  checks: [
    { id: "account", passed: true, detail: "El pago llegó a Bancolombia." },
    { id: "amount", passed: false, detail: "Se pagó $ 149.900; se esperaban $ 150.000." }
  ],
  fields: { valor: "149900", moneda: "COP", cuenta_destino: "123-456-74567", referencia: "M8743219" },
  text: "Transferencia exitosa $ 149.900",
  method: "ocr",
  durationMs: 820,
  missingVariables: []
};

describe("PaymentProofEditor · Probar", () => {
  it("sin conexión, lo explica en lugar de mostrar un botón que no sirve", () => {
    render(<Editor resources={{ labels: [] }} />);
    expect(screen.getByText(/La prueba está disponible al editar el flujo con conexión/)).toBeInTheDocument();
  });

  it("revisa el comprobante subido con la configuración del editor y los valores de prueba", async () => {
    const testPaymentProof = vi.fn(async () => ({ ok: true as const, value: RESULT }));
    render(<Editor resources={{ labels: [], testPaymentProof }} config={{ amountCheck: "exact", expectedAmount: "{precio}" }} />);

    const send = screen.getByRole("button", { name: "Revisar comprobante" });
    expect(send).toBeDisabled();

    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "pago.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText(/Elige un comprobante de ejemplo/), file);
    await userEvent.type(screen.getByRole("textbox", { name: "Valor de prueba para precio" }), "150000");
    await userEvent.click(screen.getByRole("button", { name: "Revisar comprobante" }));

    const [config, sent, variables] = testPaymentProof.mock.calls[0]! as unknown as [Record<string, unknown>, File, Record<string, string>];
    expect(config).toMatchObject({ amountCheck: "exact", expectedAmount: "{precio}" });
    expect(sent.name).toBe("pago.png");
    expect(variables).toEqual({ precio: "150000" });

    expect(await screen.findByText("Monto incorrecto", { selector: ".pp-test__status strong" })).toBeInTheDocument();
    expect(screen.getByLabelText("No cumple")).toBeInTheDocument();
    expect(screen.getByText("M8743219")).toBeInTheDocument();
    expect(screen.getByText("••••4567")).toBeInTheDocument();
    expect(screen.getByText(/no gasta el comprobante/)).toBeInTheDocument();
  });

  it("muestra el motivo si la prueba no se pudo hacer", async () => {
    const testPaymentProof = vi.fn(async () => ({ ok: false as const, message: "El archivo pesa más de 2.5 MB." }));
    render(<Editor resources={{ labels: [], testPaymentProof }} />);
    await userEvent.upload(screen.getByLabelText(/Elige un comprobante de ejemplo/), new File(["%PDF"], "pago.pdf", { type: "application/pdf" }));
    await userEvent.click(screen.getByRole("button", { name: "Revisar comprobante" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("2.5 MB");
  });
});
