import "@shared/ui/controls/controls.css";
import "./crm-dialogs.css";
import "./pipeline-settings.css";
import { useId, useState } from "react";
import type { EntrySource, PipelineSummary, SavePipelineRequest } from "@contracts/CrmContracts";
import type { ProductSummary } from "@contracts/SalesContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { StageRowsEditor, type StageRow } from "./StageRowsEditor";

const rowsOf = (pipeline: PipelineSummary | null): StageRow[] =>
  pipeline
    ? pipeline.stages.map((stage) => ({ key: stage.id, id: stage.id, name: stage.name, color: stage.color, outcome: stage.outcome }))
    : [
        { key: "a", name: "Nuevo", color: "#8b5cf6", outcome: "open" },
        { key: "b", name: "Pagó", color: "#0d9488", outcome: "won" }
      ];

/**
 * Configurar un embudo (o crear uno): sus etapas, en cuál entra quien escribe
 * y aún no está en él (todos o solo los de anuncios), a cuál pasa quien compra, el producto que da el valor por defecto y
 * si se reparte entre el equipo. Cada etapa es una etiqueta.
 */
export function PipelineSettingsDialog({
  pipeline,
  products,
  onSave,
  onDelete,
  onClose
}: {
  readonly pipeline: PipelineSummary | null;
  readonly products: ReadonlyArray<ProductSummary>;
  readonly onSave: (request: SavePipelineRequest) => Promise<unknown>;
  readonly onDelete: (() => void) | null;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const [name, setName] = useState(pipeline?.name ?? "");
  const [rows, setRows] = useState<ReadonlyArray<StageRow>>(rowsOf(pipeline));
  const keyOf = (stageId: string | null | undefined) => rows.find((row) => row.id === stageId)?.key ?? "";
  const [entry, setEntry] = useState(pipeline ? keyOf(pipeline.entryStageId) : "a");
  const [sale, setSale] = useState(pipeline ? keyOf(pipeline.saleStageId) : "b");
  const [productId, setProductId] = useState(pipeline?.defaultProductId ?? "");
  const [autoAssign, setAutoAssign] = useState(pipeline?.autoAssign ?? false);
  const [entrySource, setEntrySource] = useState<EntrySource>(pipeline?.entrySource ?? "all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const indexOf = (key: string) => {
    const index = rows.findIndex((row) => row.key === key);
    return index >= 0 ? index : null;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave({
        name,
        stages: rows.map((row) => ({ ...(row.id ? { id: row.id } : {}), name: row.name, color: row.color, outcome: row.outcome })),
        entryStage: rows.find((row) => row.key === entry)?.outcome === "open" ? indexOf(entry) : null,
        saleStage: rows.find((row) => row.key === sale)?.outcome === "won" ? indexOf(sale) : null,
        defaultProductId: productId || null,
        autoAssign,
        entrySource
      });
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo guardar el embudo."));
      setBusy(false);
    }
  };

  const named = (outcome: StageRow["outcome"]) => rows.filter((row) => row.outcome === outcome && row.name.trim());

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <form className="ui-dialog crm-dialog pipeline-settings" onClick={(event) => event.stopPropagation()} onSubmit={(event) => void submit(event)}>
        <div>
          <h2 id={titleId}>{pipeline ? "Configurar el embudo" : "Nuevo embudo"}</h2>
          <p className="ui-muted">Cada etapa es una etiqueta. Un cliente está en una sola etapa: al ponerle una, se le quita la anterior.</p>
        </div>
        <label className="ui-field">
          <span>Nombre del embudo</span>
          <input className="ui-input" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} autoFocus={!pipeline} />
        </label>
        <StageRowsEditor rows={rows} onChange={setRows} />
        <fieldset className="pipeline-settings__auto">
          <legend>Movimientos automáticos</legend>
          <label className="ui-field">
            <span>Quien te escribe y aún no está en el embudo entra en</span>
            <select className="ui-input" value={entry} onChange={(event) => setEntry(event.target.value)}>
              <option value="">Nadie entra solo (los agrego yo)</option>
              {named("open").map((row) => <option key={row.key} value={row.key}>{row.name}</option>)}
            </select>
          </label>
          {entry ? (
            <label className="ui-field">
              <span>Entran solos</span>
              <select className="ui-input" value={entrySource} onChange={(event) => setEntrySource(event.target.value as EntrySource)}>
                <option value="all">Todos los que escriben (nuevos y de antes)</option>
                <option value="ads">Solo los que llegan de un anuncio</option>
              </select>
            </label>
          ) : null}
          <label className="ui-field">
            <span>Cuando se aprueba una venta, pasa a</span>
            <select className="ui-input" value={sale} onChange={(event) => setSale(event.target.value)}>
              <option value="">No moverlo</option>
              {named("won").map((row) => <option key={row.key} value={row.key}>{row.name}</option>)}
            </select>
          </label>
          <label className="ui-field">
            <span>Valor de quien entra: el precio de</span>
            <select className="ui-input" value={productId} onChange={(event) => setProductId(event.target.value)}>
              <option value="">Sin valor por defecto</option>
              {products.filter((product) => product.status === "active").map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </label>
          <label className="pipeline-settings__check">
            <input type="checkbox" checked={autoAssign} onChange={(event) => setAutoAssign(event.target.checked)} />
            Repartir a los que entran entre el equipo, por turnos
          </label>
          <p className="ui-muted pipeline-settings__hint">Además, cualquier flujo mueve clientes con el bloque Etiquetas poniendo la etiqueta de la etapa.</p>
        </fieldset>
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer pipeline-settings__footer">
          {onDelete ? <button type="button" className="ui-btn ui-btn--danger" onClick={onDelete} disabled={busy}>Quitar embudo</button> : null}
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </div>
  );
}
