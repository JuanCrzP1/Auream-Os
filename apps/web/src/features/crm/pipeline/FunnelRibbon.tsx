import "./funnel-ribbon.css";
import { useId } from "react";
import type { StageSummary } from "@contracts/CrmContracts";
import { percent } from "../crmFormat";

/**
 * La cinta del embudo: cada etapa (sin las de «no compró») se angosta según
 * cuántos llegaron hasta ahí, con el color de su etiqueta, y entre etapas qué
 * parte avanza. Solo dibuja; los números vienen del servidor.
 */
export function FunnelRibbon({
  stages,
  counts,
  advance,
  compact = false
}: {
  readonly stages: ReadonlyArray<StageSummary>;
  readonly counts: ReadonlyMap<string, number>;
  readonly advance: ReadonlyArray<number | null>;
  readonly compact?: boolean;
}) {
  // Un id que sirve dentro de `url(#…)` (sin los «:» de React).
  const gradientId = `funnel-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (stages.length === 0) return null;
  const reached = reachedOf(stages, counts);
  // Vacío: la silueta de un embudo, tenue, para que se entienda qué va ahí.
  const empty = reached[0] === 0;
  const path = ribbonPath(empty ? stages.map((_, index) => stages.length - index) : reached);
  const lastOpen = stages.findIndex((stage) => stage.outcome === "won");

  return (
    <div className={`funnel-ribbon${compact ? " funnel-ribbon--compact" : ""}${empty ? " funnel-ribbon--empty" : ""}`}>
      <svg viewBox="0 0 1000 140" preserveAspectRatio="none" className="funnel-ribbon__svg" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            {stages.map((stage, index) => (
              <stop key={stage.id} offset={`${((index + 0.5) / stages.length) * 100}%`} stopColor={stage.color} />
            ))}
          </linearGradient>
        </defs>
        <path d={path} fill={`url(#${gradientId})`} className="funnel-ribbon__band" />
        <path d={path} className="funnel-ribbon__shine" />
        {stages.slice(1).map((stage, index) => (
          <line key={stage.id} x1={((index + 1) * 1000) / stages.length} x2={((index + 1) * 1000) / stages.length} y1="0" y2="140" className="funnel-ribbon__divider" />
        ))}
      </svg>
      {advance.map((value, index) => value === null ? null : (
        <span key={stages[index]!.id} className="funnel-ribbon__chip" style={{ left: `${((index + 1) / stages.length) * 100}%` }}>
          {percent(value)} {index + 1 === lastOpen ? "compra" : "avanza"}
        </span>
      ))}
    </div>
  );
}

/** Los que llegaron a cada etapa o más allá (por eso la cinta nunca se ensancha). */
export function reachedOf(stages: ReadonlyArray<StageSummary>, counts: ReadonlyMap<string, number>): number[] {
  const reached: number[] = [];
  let running = 0;
  for (let index = stages.length - 1; index >= 0; index -= 1) {
    running += counts.get(stages[index]!.id) ?? 0;
    reached[index] = running;
  }
  return reached;
}

/** La silueta: tramos planos por etapa unidos por curvas suaves en cada frontera. */
export function ribbonPath(reached: ReadonlyArray<number>): string {
  const n = reached.length;
  const width = 1000 / n;
  const top = reached.map((value) => {
    const share = reached[0]! > 0 ? value / reached[0]! : 1;
    const height = 120 * Math.max(0.18, share);
    return Math.round((70 - height / 2) * 10) / 10;
  });
  const bottom = top.map((y) => Math.round((140 - y) * 10) / 10);
  const edge = (ys: number[], forward: boolean) => {
    const order = forward ? ys.map((_, i) => i) : ys.map((_, i) => n - 1 - i);
    let d = "";
    order.forEach((i, step) => {
      const start = forward ? i * width + (i === 0 ? 0 : width * 0.25) : (i + 1) * width - (i === n - 1 ? 0 : width * 0.25);
      const end = forward ? (i + 1) * width - (i === n - 1 ? 0 : width * 0.25) : i * width + (i === 0 ? 0 : width * 0.25);
      if (step > 0) {
        const prev = order[step - 1]!;
        const boundary = forward ? i * width : (i + 1) * width;
        d += ` C${boundary},${ys[prev]} ${boundary},${ys[i]} ${start},${ys[i]}`;
      }
      d += `${step === 0 && forward ? "M" : " L"}${start},${ys[i]} L${end},${ys[i]}`;
    });
    return d;
  };
  return `${edge(top, true)}${edge(bottom, false)} Z`;
}
