import type { BuilderFlowSnapshot } from "../../../../contracts/FlowSnapshot";
import { AI_LEGACY_SECRET_FIELDS } from "../../../../contracts/AiConfig";

// ---------------------------------------------------------------------------
// Un flujo no guarda secretos. Las versiones anteriores del bloque de IA
// pedían la clave de API dentro del bloque (`apiKey`, con su `provider`); hoy
// la clave vive cifrada en una conexión de IA de la cuenta. Esto la quita de
// cualquier flujo que entre o salga del almacén. Puro.
// ---------------------------------------------------------------------------

export function stripInlineSecrets(snapshot: BuilderFlowSnapshot): BuilderFlowSnapshot {
  let changed = false;
  const nodes = Object.fromEntries(
    Object.entries(snapshot.nodes).map(([id, node]) => {
      if (node.type !== "ai" || !AI_LEGACY_SECRET_FIELDS.some((field) => field in node.config)) return [id, node];
      changed = true;
      const config = { ...node.config };
      for (const field of AI_LEGACY_SECRET_FIELDS) delete config[field];
      return [id, { ...node, config }];
    })
  );
  return changed ? { ...snapshot, nodes } : snapshot;
}
