import { NodeRuntime } from "../../../flow-engine/nodes/NodeRuntime";
import { AiNodeHandler } from "../../../flow-engine/nodes/ai/AiNodeHandler";
import { ConditionNodeHandler } from "../../../flow-engine/nodes/condition/ConditionNodeHandler";
import { DelayNodeHandler } from "../../../flow-engine/nodes/delay/DelayNodeHandler";
import { DistributorNodeHandler } from "../../../flow-engine/nodes/distributor/DistributorNodeHandler";
import { EndNodeHandler } from "../../../flow-engine/nodes/end/EndNodeHandler";
import { IntegrationNodeHandler } from "../../../flow-engine/nodes/integration/IntegrationNodeHandler";
import { MenuNodeHandler } from "../../../flow-engine/nodes/menu/MenuNodeHandler";
import { MessageNodeHandler } from "../../../flow-engine/nodes/message/MessageNodeHandler";
import { NotificationNodeHandler } from "../../../flow-engine/nodes/notification/NotificationNodeHandler";
import { PaymentProofNodeHandler } from "../../../flow-engine/nodes/payment-proof/PaymentProofNodeHandler";
import { PixelNodeHandler } from "../../../flow-engine/nodes/pixel/PixelNodeHandler";
import { QuestionNodeHandler } from "../../../flow-engine/nodes/question/QuestionNodeHandler";
import { SaleApprovedNodeHandler } from "../../../flow-engine/nodes/sale-approved/SaleApprovedNodeHandler";
import { TagsNodeHandler } from "../../../flow-engine/nodes/tags/TagsNodeHandler";

// ---------------------------------------------------------------------------
// composeNodeRuntime
//
// Responsabilidad única: registrar los handlers de nodo disponibles.
//
// Debe existir un handler por cada miembro de `NodeType`: `NodeRuntime` lanza
// si no encuentra ninguno que soporte el tipo.
//
// No existe handler de handoff: derivar a un asesor humano es responsabilidad
// del AI Sales Engine, no del Flow Engine.
// ---------------------------------------------------------------------------

export function composeNodeRuntime(): NodeRuntime {
  return new NodeRuntime([
    new MessageNodeHandler(),
    new QuestionNodeHandler(),
    new TagsNodeHandler(),
    new PaymentProofNodeHandler(),
    new ConditionNodeHandler(),
    new DistributorNodeHandler(),
    new PixelNodeHandler(),
    new AiNodeHandler(),
    new DelayNodeHandler(),
    new SaleApprovedNodeHandler(),
    new IntegrationNodeHandler(),
    new MenuNodeHandler(),
    new NotificationNodeHandler(),
    new EndNodeHandler()
  ]);
}
