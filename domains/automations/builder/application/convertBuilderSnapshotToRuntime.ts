import type { FlowSnapshot, BuilderFlowSnapshot } from "../../../../contracts/FlowSnapshot";

export function convertBuilderSnapshotToRuntime(snapshot: BuilderFlowSnapshot, tenantId: string): FlowSnapshot {
  return {
    flow: {
      id: snapshot.flow.id,
      tenantId,
      key: snapshot.flow.key,
      name: snapshot.flow.name,
      currentPublishedVersionId: snapshot.version.id
    },
    version: {
      id: snapshot.version.id,
      tenantId,
      flowId: snapshot.flow.id,
      versionNumber: snapshot.version.versionNumber,
      status: snapshot.version.status,
      entryNodeId: snapshot.version.entryNodeId
    },
    nodes: Object.fromEntries(
      Object.values(snapshot.nodes).map((node) => [
        node.id,
        {
          id: node.id,
          tenantId,
          flowVersionId: snapshot.version.id,
          type: node.type,
          name: node.name,
          content: node.content,
          config: node.config,
          metadata: node.metadata
        }
      ])
    ),
    edgesBySource: Object.fromEntries(
      Object.entries(snapshot.edgesBySource).map(([sourceNodeId, edges]) => [
        sourceNodeId,
        edges.map((edge) => ({
          id: edge.id,
          tenantId,
          flowVersionId: snapshot.version.id,
          fromNodeId: edge.fromNodeId,
          toNodeId: edge.toNodeId,
          priority: edge.priority,
          isFallback: edge.isFallback,
          condition: edge.condition
        }))
      ])
    )
  };
}