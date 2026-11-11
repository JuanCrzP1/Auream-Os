import { useEffect, useState } from "react";
import type { SavedAudience } from "@contracts/BroadcastResultsContracts";
import type { LabelSummary } from "@contracts/ContactContracts";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import type { PipelineSummary } from "@contracts/CrmContracts";
import { fetchFlowOptions, type FlowOption } from "@shared/automations/flowOptions";
import { fetchConnections } from "@shared/connections/connectionsApi";
import { fetchLabels } from "@shared/labels/labelsApi";
import { broadcastsApi } from "../services/broadcastsApi";

export interface WizardData {
  readonly flows: ReadonlyArray<FlowOption>;
  readonly connections: ReadonlyArray<ConnectionSummary>;
  readonly labels: ReadonlyArray<LabelSummary>;
  readonly pipelines: ReadonlyArray<PipelineSummary>;
  readonly audiences: ReadonlyArray<SavedAudience>;
  readonly ready: boolean;
}

/** Flujos, números, etiquetas, embudos del CRM y audiencias guardadas. Lo que no cargue queda vacío. */
export function useWizardData() {
  const [data, setData] = useState<WizardData>({ flows: [], connections: [], labels: [], pipelines: [], audiences: [], ready: false });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchFlowOptions().catch(() => []),
      fetchConnections().catch(() => []),
      fetchLabels().catch(() => []),
      broadcastsApi.pipelines().then((r) => r.pipelines).catch(() => []),
      broadcastsApi.audiences().catch(() => [])
    ]).then(([flows, connections, labels, pipelines, audiences]) => {
      if (!cancelled) setData({ flows, connections, labels, pipelines, audiences, ready: true });
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  return { ...data, reloadAudiences: () => setVersion((v) => v + 1) };
}
