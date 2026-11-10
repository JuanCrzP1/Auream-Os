import "./crm-header-actions.css";
import type { PipelineSummary } from "@contracts/CrmContracts";
import { CRM_PIPELINES_MAX } from "@contracts/CrmContracts";

/** Arriba a la derecha: qué embudo se ve, configurarlo o crear otro, y agregar un cliente. */
export function CrmHeaderActions({ pipelines, selected, canWrite, canManage, onSelect, onConfigure, onNewPipeline, onAddClient }: {
  readonly pipelines: ReadonlyArray<PipelineSummary>;
  readonly selected: PipelineSummary;
  readonly canWrite: boolean;
  readonly canManage: boolean;
  readonly onSelect: (pipelineId: string) => void;
  readonly onConfigure: () => void;
  readonly onNewPipeline: () => void;
  readonly onAddClient: () => void;
}) {
  return (
    <div className="crm-header-actions">
      <label className="crm-header-actions__picker">
        <span>Embudo</span>
        <select
          value={selected.id}
          aria-label="Embudo"
          onChange={(event) => (event.target.value === "__new" ? onNewPipeline() : onSelect(event.target.value))}
        >
          {pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
          {canManage && pipelines.length < CRM_PIPELINES_MAX ? <option value="__new">+ Nuevo embudo…</option> : null}
        </select>
      </label>
      {canManage ? <button type="button" className="ui-btn ui-btn--ghost" onClick={onConfigure}>Configurar</button> : null}
      {canWrite ? <button type="button" className="ui-btn ui-btn--primary" onClick={onAddClient}>+ Agregar cliente</button> : null}
    </div>
  );
}
