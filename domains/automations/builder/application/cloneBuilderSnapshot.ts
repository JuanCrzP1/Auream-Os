import type { BuilderFlowSnapshot } from "../../../../contracts/FlowSnapshot";

export function cloneBuilderSnapshot(snapshot: BuilderFlowSnapshot): BuilderFlowSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as BuilderFlowSnapshot;
}