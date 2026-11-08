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
import { StartNodeHandler } from "../../../flow-engine/nodes/start/StartNodeHandler";
import { QuestionNodeHandler } from "../../../flow-engine/nodes/question/QuestionNodeHandler";
import { TagsNodeHandler } from "../../../flow-engine/nodes/tags/TagsNodeHandler";
import type { RoundRobinCounter } from "../../../flow-engine/ports/RoundRobinCounter";
import { InMemoryRoundRobinCounter } from "../../../infrastructure/persistence/memory/InMemoryRoundRobinCounter";
import type { ContactDirectory } from "../../../flow-engine/ports/ContactDirectory";
import { ContactDirectoryService } from "../../../domains/contacts/application/ContactDirectoryService";
import {
  InMemoryContactRepository,
  InMemoryContactsStore,
  InMemoryLabelRepository
} from "../../../infrastructure/persistence/memory/InMemoryContactRepositories";

/** Dependencias externas de los bloques. Cada entorno inyecta las suyas. */
export interface NodeRuntimeDependencies {
  /** Turnos del Distribuidor. Simulación: en memoria; producción: PostgreSQL. */
  readonly roundRobin: RoundRobinCounter;
  /** Contacto de la conversación. Simulación: en memoria; producción: PostgreSQL. */
  readonly contacts: ContactDirectory;
}

/** Dependencias aisladas para simular: no tocan turnos ni contactos reales. */
export function simulationDependencies(): NodeRuntimeDependencies {
  const store = new InMemoryContactsStore();
  return {
    roundRobin: new InMemoryRoundRobinCounter(),
    contacts: new ContactDirectoryService(new InMemoryContactRepository(store), new InMemoryLabelRepository(store))
  };
}

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

export function composeNodeRuntime(
  dependencies: NodeRuntimeDependencies = simulationDependencies()
): NodeRuntime {
  return new NodeRuntime([
    new StartNodeHandler(),
    new MessageNodeHandler(),
    new QuestionNodeHandler(),
    new TagsNodeHandler(dependencies.contacts),
    new PaymentProofNodeHandler(),
    new ConditionNodeHandler(dependencies.contacts),
    new DistributorNodeHandler(dependencies.roundRobin),
    new PixelNodeHandler(),
    new AiNodeHandler(),
    new DelayNodeHandler(),
    new IntegrationNodeHandler(),
    new MenuNodeHandler(),
    new NotificationNodeHandler(),
    new EndNodeHandler()
  ]);
}
