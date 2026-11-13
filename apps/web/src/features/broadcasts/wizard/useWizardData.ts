import { useEffect, useState } from "react";
import type { SavedAudience } from "@contracts/BroadcastResultsContracts";
import type { LabelSummary } from "@contracts/ContactContracts";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import type { PipelineSummary } from "@contracts/CrmContracts";
import { fetchFlowOptions, type FlowOption } from "@shared/automations/flowOptions";
import { fetchConnections } from "@shared/connections/connectionsApi";
import { fetchLabels } from "@shared/labels/labelsApi";
import { fetchContactFields } from "@shared/contact-fields/contactFieldsApi";
import type { ContactFieldSummary } from "@contracts/ContactFieldContracts";
import { broadcastsApi } from "../services/broadcastsApi";

export interface WizardData {
  readonly flows: ReadonlyArray<FlowOption>;
  readonly connections: ReadonlyArray<ConnectionSummary>;
  readonly labels: ReadonlyArray<LabelSummary>;
  readonly pipelines: ReadonlyArray<PipelineSummary>;
  readonly audiences: ReadonlyArray<SavedAudience>;
  /** Los Campos del cliente de la cuenta (para filtrar a quién le llega). */
  readonly fields: ReadonlyArray<ContactFieldSummary>;
  readonly ready: boolean;
}

/** Flujos, números, etiquetas, embudos del CRM, audiencias guardadas y Campos del cliente. Lo que no cargue queda vacío. */
export function useWizardData() {
  const [data, setData] = useState<WizardData>({ flows: [], connections: [], labels: [], pipelines: [], audiences: [], fields: [], ready: false });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchFlowOptions().catch(() => []),
      fetchConnections().catch(() => []),
      fetchLabels().catch(() => []),
      broadcastsApi.pipelines().then((r) => r.pipelines).catch(() => []),
      broadcastsApi.audiences().catch(() => []),
      fetchContactFields().then((r) => r.fields).catch(() => [])
    ]).then(([flows, connections, labels, pipelines, audiences, fields]) => {
      if (!cancelled) setData({ flows, connections, labels, pipelines, audiences, fields, ready: true });
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  return { ...data, reloadAudiences: () => setVersion((v) => v + 1) };
}
