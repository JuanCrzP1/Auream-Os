import type { LabelSummary } from "@contracts/ContactContracts";
import type { PipelineSummary } from "@contracts/CrmContracts";

/**
 * Etiquetas y etapas del CRM (cada etapa es una etiqueta). Un toque incluye,
 * otro excluye, otro la quita. Con varias incluidas basta tener una.
 */
export function LabelPicker({ labels, pipelines, include, exclude, onChange }: {
  readonly labels: ReadonlyArray<LabelSummary>;
  readonly pipelines: ReadonlyArray<PipelineSummary>;
  readonly include: ReadonlyArray<string>;
  readonly exclude: ReadonlyArray<string>;
  readonly onChange: (include: string[], exclude: string[]) => void;
}) {
  const stageLabels = new Set(pipelines.flatMap((pipeline) => pipeline.stages.map((stage) => stage.labelId)));
  const others = labels.filter((label) => !stageLabels.has(label.id));
  const cycle = (id: string) => {
    if (include.includes(id)) return onChange(include.filter((x) => x !== id), [...exclude, id]);
    if (exclude.includes(id)) return onChange([...include], exclude.filter((x) => x !== id));
    onChange([...include, id], [...exclude]);
  };
  const chip = (id: string, name: string) => {
    const state = include.includes(id) ? "on" : exclude.includes(id) ? "off" : null;
    return (
      <button key={id} type="button" className={`bc-chip${state ? ` bc-chip--${state}` : ""}`} onClick={() => cycle(id)} aria-label={`${name}${state === "on" ? ": incluida" : state === "off" ? ": excluida" : ""}`}>
        {state === "on" ? "✓ " : state === "off" ? "✕ " : ""}
        {name}
      </button>
    );
  };

  return (
    <>
      {pipelines.map((pipeline) => (
        <div key={pipeline.id} className="bc-group">
          <span className="bc-group__label">Etapa del CRM · {pipeline.name}</span>
          <div className="bc-chips">{[...pipeline.stages].sort((a, b) => a.position - b.position).map((stage) => chip(stage.labelId, stage.name))}</div>
        </div>
      ))}
      <div className="bc-group">
        <span className="bc-group__label">Etiquetas</span>
        {others.length > 0 ? <div className="bc-chips">{others.map((label) => chip(label.id, label.name))}</div> : <span className="bc-hint">Aún no tienes etiquetas.</span>}
        <span className="bc-hint">Toca una vez para incluir, otra para excluir. Sin elegir, todos los que escribieron.</span>
      </div>
    </>
  );
}
