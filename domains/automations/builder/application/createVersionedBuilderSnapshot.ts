import type { BuilderFlowSnapshot } from "../../../../contracts/FlowSnapshot";
import { cloneBuilderSnapshot } from "./cloneBuilderSnapshot";

export function createVersionedBuilderSnapshot(
  snapshot: BuilderFlowSnapshot,
  status: BuilderFlowSnapshot["version"]["status"],
  versionNumber: number
): BuilderFlowSnapshot {
  const cloned = cloneBuilderSnapshot(snapshot);
  return {
    ...cloned,
    version: {
      ...cloned.version,
      id: `${cloned.flow.id}:v${versionNumber}:${status}`,
      versionNumber,
      status
    }
  };
}