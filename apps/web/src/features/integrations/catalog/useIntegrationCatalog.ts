import { buildEntries, combineStatus, type IntegrationEntry } from "./integrationCatalog";
import { INTEGRATION_DEFINITIONS } from "./integrationRegistry";
import { useAiSource, usePixelSource, useWebhookSource } from "./sources";
import type { ConnectionListStatus } from "../components/IntegrationSection";

/** Todas las integraciones con su conteo en vivo (una consulta por fuente). */
export function useIntegrationCatalog(): { readonly status: ConnectionListStatus; readonly entries: ReadonlyArray<IntegrationEntry>; readonly refresh: () => Promise<void> } {
  const sources = [useAiSource(), usePixelSource(), useWebhookSource()];
  return {
    status: combineStatus(sources.map((source) => source.status)),
    entries: buildEntries(INTEGRATION_DEFINITIONS, sources),
    refresh: async () => {
      await Promise.all(sources.map((source) => source.refresh()));
    }
  };
}
