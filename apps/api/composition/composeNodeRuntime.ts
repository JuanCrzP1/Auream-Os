import { NodeRuntime } from "../../../flow-engine/nodes/NodeRuntime";
import { ActionNodeHandler } from "../../../flow-engine/nodes/action/ActionNodeHandler";
import { AiNodeHandler } from "../../../flow-engine/nodes/ai/AiNodeHandler";
import { CaptureNodeHandler } from "../../../flow-engine/nodes/capture/CaptureNodeHandler";
import { ConditionNodeHandler } from "../../../flow-engine/nodes/condition/ConditionNodeHandler";
import { DelayNodeHandler } from "../../../flow-engine/nodes/delay/DelayNodeHandler";
import { EndNodeHandler } from "../../../flow-engine/nodes/end/EndNodeHandler";
import { FallbackNodeHandler } from "../../../flow-engine/nodes/fallback/FallbackNodeHandler";
import { MessageNodeHandler } from "../../../flow-engine/nodes/message/MessageNodeHandler";
import { QuestionNodeHandler } from "../../../flow-engine/nodes/question/QuestionNodeHandler";

// ---------------------------------------------------------------------------
// composeNodeRuntime
//
// Responsabilidad única: registrar los handlers de nodo disponibles.
//
// No existe handler de handoff: derivar a un asesor humano es responsabilidad
// del AI Sales Engine, no del Flow Engine.
// ---------------------------------------------------------------------------

export function composeNodeRuntime(): NodeRuntime {
  return new NodeRuntime([
    new ActionNodeHandler(),
    new AiNodeHandler(),
    new MessageNodeHandler(),
    new QuestionNodeHandler(),
    new CaptureNodeHandler(),
    new ConditionNodeHandler(),
    new DelayNodeHandler(),
    new FallbackNodeHandler(),
    new EndNodeHandler()
  ]);
}
