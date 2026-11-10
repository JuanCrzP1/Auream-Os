import type { Money, PipelineMetrics } from "../../../contracts/CrmContracts";
import { funnelStages, type Pipeline } from "./Pipeline";

// ---------------------------------------------------------------------------
// Los números del embudo, a partir de cuántos hay en cada etapa (cálculo
// puro; las sumas salen de la base).
//
// «Avanza»: de los que llegaron a una etapa, cuántos llegaron a la siguiente.
// Quien está en «Pagó» ya pasó por «Interesado», así que se cuenta de forma
// acumulada (lo estándar en un embudo). Las etapas de «no compró» no forman
// parte de la cinta: se restan aparte.
// ---------------------------------------------------------------------------

export interface MetricsInput {
  readonly counts: ReadonlyMap<string, number>;
  readonly openTotals: ReadonlyArray<Money>;
  readonly wonTotals: ReadonlyArray<Money>;
  readonly wonCount: number;
  readonly avgDaysToClose: number | null;
}

export function pipelineMetrics(pipeline: Pick<Pipeline, "stages">, input: MetricsInput): PipelineMetrics {
  const countOf = (stageId: string) => input.counts.get(stageId) ?? 0;
  const funnel = funnelStages(pipeline);
  // Acumulado desde el final: los que llegaron a la etapa i o más allá.
  const reached: number[] = [];
  let running = 0;
  for (let index = funnel.length - 1; index >= 0; index -= 1) {
    running += countOf(funnel[index]!.id);
    reached[index] = running;
  }
  const advance = funnel.slice(0, -1).map((_, index) => (reached[index]! > 0 ? reached[index + 1]! / reached[index]! : null));

  const total = pipeline.stages.reduce((sum, stage) => sum + countOf(stage.id), 0);
  const won = pipeline.stages.filter((stage) => stage.outcome === "won").reduce((sum, stage) => sum + countOf(stage.id), 0);
  const open = pipeline.stages.filter((stage) => stage.outcome === "open").reduce((sum, stage) => sum + countOf(stage.id), 0);
  const lost = pipeline.stages.filter((stage) => stage.outcome === "lost").reduce((sum, stage) => sum + countOf(stage.id), 0);

  return {
    openTotals: input.openTotals,
    openCount: open,
    wonTotals: input.wonTotals,
    wonCount: input.wonCount,
    closeRate: total > 0 ? won / total : null,
    avgDaysToClose: input.avgDaysToClose,
    lostCount: lost,
    advance
  };
}
