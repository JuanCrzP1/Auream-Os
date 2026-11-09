import type { FlowNode } from "../../../contracts/FlowSnapshot";
import { PAYMENT_PROOF_OUTPUT, readPaymentProofConfig } from "../../../contracts/PaymentProofConfig";
import type { NodeExecutionResult, RuntimeInput, Session } from "../../../contracts/RuntimeContracts";
import { identityOf, type ContactDirectory } from "../../ports/ContactDirectory";
import { templateResolver } from "../../templates/templateResolver";
import type { NodeHandler } from "../NodeHandler";
import { runPaymentProofStep, type PaymentProofPorts } from "./runPaymentProofStep";

// ---------------------------------------------------------------------------
// PaymentProofNodeHandler — el bloque «Comprobante automático».
//
// Lee la imagen o el PDF que mandó el cliente (OCR propio, sin IA), lo
// contrasta con las cuentas del negocio y sale por la salida que corresponde:
// válido, cuenta no registrada, titular incorrecto, monto incorrecto,
// antiguo, repetido, no es un comprobante o error.
//
// Los datos leídos quedan en la conversación como `<variable>.valor`,
// `<variable>.referencia`… para usarlos en los bloques siguientes.
// ---------------------------------------------------------------------------

export class PaymentProofNodeHandler implements NodeHandler {
  public constructor(
    private readonly ports: PaymentProofPorts,
    private readonly contacts: ContactDirectory
  ) {}

  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "payment-proof";
  }

  public async execute(node: FlowNode, input: RuntimeInput, session: Session): Promise<NodeExecutionResult> {
    const config = readPaymentProofConfig(node.config);
    const contact = await this.contacts.resolve(session.tenantId, identityOf(input.envelope));
    const context = { ...input.sessionContext, ...session.context };

    const step = await runPaymentProofStep(
      config,
      {
        tenantId: session.tenantId,
        resolve: templateResolver({ ...input, sessionContext: context }, contact),
        now: new Date(input.now),
        timezone: input.timezone,
        claim: { conversationKey: input.envelope.conversationKey, flowKey: input.envelope.flowKey }
      },
      this.ports
    );

    const valid = step.output === PAYMENT_PROOF_OUTPUT.valid;
    const prefix = config.resultVariable;
    const contextPatch: Record<string, unknown> = {};
    if (prefix) {
      for (const [field, value] of Object.entries(step.fields)) contextPatch[`${prefix}.${field}`] = value;
    }
    if (!valid && config.errorVariable) contextPatch[config.errorVariable] = step.message;

    return {
      executionStatus: "success",
      output: step.output,
      outputMessages: [],
      contextPatch,
      nodeResult: {
        output: step.output,
        message: step.message,
        ...(step.failure ? { reason: step.failure } : {}),
        ...(step.method ? { method: step.method } : {}),
        checks: step.checks.map((check) => ({ id: check.id, passed: check.passed })),
        fields: step.fields,
        durationMs: step.durationMs
      },
      domainEvents: [
        `payment_proof_${step.output}:${node.id}`,
        ...step.missingVariables.map((name) => `payment_proof_variable_missing:${node.id}:${name}`)
      ]
    };
  }
}
