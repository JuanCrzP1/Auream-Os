import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  groupIssuesByNode,
  type FlowReview,
  type NodeReviewStatus
} from "@features/automations/builder/services/reviewFlow";

// ---------------------------------------------------------------------------
// Estado de revisión de cada bloque, para las tarjetas del lienzo.
//
// Las tarjetas las instancia React Flow: no reciben props desde la página
// (mismo motivo que `BuilderEditingContext`). Este contexto les reparte, ya
// agrupado por bloque, lo que `reviewFlow` encontró. Solo lectura.
// ---------------------------------------------------------------------------

const EMPTY: ReadonlyMap<string, NodeReviewStatus> = new Map();

const FlowReviewContext = createContext<ReadonlyMap<string, NodeReviewStatus>>(EMPTY);

interface FlowReviewProviderProps {
  readonly review: FlowReview;
  readonly children: ReactNode;
}

export function FlowReviewProvider({ review, children }: FlowReviewProviderProps) {
  // `review` ya está memoizada sobre el grafo: el mapa solo se rehace cuando
  // la revisión cambia de verdad.
  const byNode = useMemo(() => groupIssuesByNode(review), [review]);
  return <FlowReviewContext.Provider value={byNode}>{children}</FlowReviewContext.Provider>;
}

/** Problemas de un bloque, o `null` si está bien. Fuera del provider: siempre `null`. */
export function useNodeReview(nodeId: string): NodeReviewStatus | null {
  return useContext(FlowReviewContext).get(nodeId) ?? null;
}
