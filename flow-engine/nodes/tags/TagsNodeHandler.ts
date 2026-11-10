import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import { readTagsConfig } from "../../../contracts/TagsConfig";
import { identityOf, type ContactDirectory } from "../../ports/ContactDirectory";
import type { NodeHandler } from "../NodeHandler";

// ---------------------------------------------------------------------------
// TagsNodeHandler — agrega o quita etiquetas al contacto de la conversación.
// Por nombre; las que falten en el catálogo las crea el directorio. Salida
// única: el flujo sigue.
// ---------------------------------------------------------------------------

export class TagsNodeHandler implements NodeHandler {
  public constructor(private readonly contacts: ContactDirectory) {}

  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "tags";
  }

  public async execute(node: FlowNode, input: RuntimeInput, session: Session): Promise<NodeExecutionResult> {
    const config = readTagsConfig(node.config);
    const contact = await this.contacts.resolve(session.tenantId, identityOf(input.envelope));

    const updated =
      config.tags.length === 0
        ? contact
        : config.action === "add"
          ? await this.contacts.addTags(session.tenantId, contact.id, config.tags, { flowKey: input.envelope.flowKey })
          : await this.contacts.removeTags(session.tenantId, contact.id, config.tags, { flowKey: input.envelope.flowKey });

    return {
      executionStatus: "success",
      outputMessages: [],
      contextPatch: {},
      nodeResult: { contactId: contact.id, contactTags: updated.tags },
      domainEvents: [`tags_${config.action === "add" ? "added" : "removed"}:${node.id}:${config.tags.length}`]
    };
  }
}
