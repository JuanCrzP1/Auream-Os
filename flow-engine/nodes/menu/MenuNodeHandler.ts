import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, OutboundMessage, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import { MENU_OUTPUT, readMenuConfig, type MenuConfig } from "../../../contracts/MenuConfig";
import type { NodeHandler } from "../NodeHandler";
import { ConversationTemplates } from "../../templates/ConversationTemplates";
import { matchMenuReply, renderMenuText } from "./matchMenuReply";

// ---------------------------------------------------------------------------
// MenuNodeHandler — ofrece opciones y sigue por la que elija el cliente.
//
//   1ª vez      envía el menú (texto numerado + versión interactiva para que
//               WhatsApp lo pinte como botones o lista) y espera.
//   Respuesta   reconoce la opción (`matchMenuReply`) y sale por ella; si no
//               coincide con ninguna, por «Otra respuesta». Con «guardar en»,
//               deja el título elegido en el contexto.
//   Tiempo      «Tiempo agotado» lo dispara el vencimiento de la espera cuando
//               exista la cola de tareas (C6); aquí se declara el vencimiento.
// ---------------------------------------------------------------------------

const UNIT_MS = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 } as const;

function deadline(config: MenuConfig, receivedAt: string): string | null {
  if (!config.timeoutEnabled) return null;
  const start = new Date(receivedAt).getTime();
  return Number.isFinite(start) ? new Date(start + config.timeoutAmount * UNIT_MS[config.timeoutUnit]).toISOString() : null;
}

function menuMessage(config: MenuConfig, input: RuntimeInput): OutboundMessage {
  return {
    channel: input.envelope.channel,
    conversationKey: input.envelope.conversationKey,
    content: renderMenuText(config),
    interactive: {
      type: config.format === "buttons" ? "buttons" : "list",
      ...(config.title.trim() ? { header: config.title.trim() } : {}),
      body: config.message,
      ...(config.footer.trim() ? { footer: config.footer.trim() } : {}),
      ...(config.format === "list" ? { buttonLabel: config.buttonLabel } : {}),
      options: config.options.map((option) => ({
        id: option.id,
        title: option.title,
        ...(config.format === "list" && option.description.trim() ? { description: option.description } : {})
      }))
    }
  };
}

export class MenuNodeHandler implements NodeHandler {
  public constructor(private readonly templates: ConversationTemplates = new ConversationTemplates()) {}

  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "menu";
  }

  public async execute(node: FlowNode, input: RuntimeInput, session: Session): Promise<NodeExecutionResult> {
    const config = readMenuConfig(node.config);
    const payload = input.envelope.payload;
    const replied = input.isWaitingInput && (typeof payload["optionId"] === "string" || (typeof payload["text"] === "string" && payload["text"].trim() !== ""));

    if (replied) {
      const chosen = matchMenuReply(config.options, { optionId: payload["optionId"], text: payload["text"] });
      return {
        executionStatus: "success",
        output: chosen ? chosen.id : MENU_OUTPUT.other,
        outputMessages: [],
        contextPatch: chosen && config.saveToField ? { [config.saveToField]: chosen.title } : {},
        nodeResult: { menuChoice: chosen ? chosen.id : null },
        domainEvents: [chosen ? `menu_option_chosen:${node.id}:${chosen.id}` : `menu_other_reply:${node.id}`]
      };
    }

    const waitDeadlineAt = deadline(config, input.envelope.receivedAt);
    // Encabezado, mensaje y pie admiten variables; las opciones no (son lo que el cliente elige).
    const [title, message, footer] = await this.templates.render([config.title, config.message, config.footer], input, session);
    return {
      executionStatus: "waiting_input",
      outputMessages: [menuMessage({ ...config, title: title!, message: message!, footer: footer! }, input)],
      contextPatch: {},
      nodeResult: waitDeadlineAt ? { waitDeadlineAt } : {},
      domainEvents: [`menu_prompted:${node.id}`]
    };
  }
}
