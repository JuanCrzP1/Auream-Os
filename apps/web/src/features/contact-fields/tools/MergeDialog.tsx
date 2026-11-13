import "./field-tools.css";
import { useEffect, useId, useState } from "react";
import type { FieldOperationResponse, MergePreview } from "@contracts/ContactFieldToolsContracts";
import { mergeFields, previewFieldMerge } from "@shared/contact-fields/contactFieldsApi";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { clients } from "../fieldText";

// ---------------------------------------------------------------------------
// «Unir campos»: varias claves que guardan el mismo dato pasan a una. Se
// elige con cuál quedarse y se ve exactamente qué bloques cambian. Si un
// cliente tiene más de una, queda su dato más reciente. Se puede deshacer.
// ---------------------------------------------------------------------------

export function MergeDialog({
  keys,
  onDone,
  onClose
}: {
  /** Las claves candidatas (dos o más). */
  readonly keys: ReadonlyArray<string>;
  readonly onDone: (result: FieldOperationResponse) => void;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const [keep, setKeep] = useState(keys[0]!);
  const [included, setIncluded] = useState<ReadonlySet<string>>(() => new Set(keys));
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const merge = keys.filter((key) => key !== keep && included.has(key));
  const request = JSON.stringify({ keep, merge });

  useEffect(() => {
    const body = JSON.parse(request) as { keep: string; merge: string[] };
    if (body.merge.length === 0) return;
    let alive = true;
    previewFieldMerge(body).then(
      (result) => alive && (setPreview(result), setError(null)),
      (failure) => alive && setError(apiErrorMessage(failure, "No pudimos revisar qué cambia."))
    );
    return () => {
      alive = false;
    };
  }, [request]);

  const info = (key: string) => preview?.keys.find((entry) => entry.key === key);
  // Un bloque puede aparecer dos veces (guarda y lee la clave): se cuenta una.
  const blockCount = new Set((preview?.blocks ?? []).map((block) => `${block.flowKey}:${block.blockId}`)).size;
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      onDone(await mergeFields({ keep, merge }));
      onClose();
    } catch (failure) {
      setError(apiErrorMessage(failure, "No se pudo unir. Nada cambió."));
      setBusy(false);
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <div className="ui-dialog ft-dialog" onClick={(event) => event.stopPropagation()}>
        <div>
          <h2 id={titleId}>Unir {merge.length + 1} campos en uno</h2>
          <p className="ui-muted">Guardan el mismo dato con nombres distintos. Elige con cuál te quedas: los otros se pasan a ese y los bloques se actualizan solos.</p>
        </div>
        <fieldset className="ft-keys">
          <legend>Quedarse con</legend>
          {keys.map((key) => (
            <div key={key} className={`ft-key${key === keep ? " is-keep" : ""}`}>
              <label className="ft-key__keep">
                <input type="radio" name={titleId} checked={key === keep} onChange={() => (setKeep(key), setIncluded((current) => new Set([...current, key])))} />
                <code>{`{${key}}`}</code>
                {info(key)?.label ? <span>{info(key)!.label}</span> : null}
              </label>
              <span className="ft-key__count">{info(key) ? `${clients(info(key)!.filled)} · ${info(key)!.blocks} ${info(key)!.blocks === 1 ? "bloque" : "bloques"}` : ""}</span>
              {key !== keep && keys.length > 2 ? (
                <label className="ft-key__include">
                  <input type="checkbox" checked={included.has(key)} aria-label={`Unir ${key}`} onChange={(event) => setIncluded((current) => new Set(event.target.checked ? [...current, key] : [...current].filter((other) => other !== key)))} />
                  Unir
                </label>
              ) : null}
            </div>
          ))}
        </fieldset>

        {merge.length === 0 ? <p className="ui-muted">Marca al menos otro campo para unir.</p> : null}
        {preview && merge.length > 0 ? (
          <>
            <section className="ft-blocks" aria-label="Bloques que cambian">
              <strong>{preview.blocks.length === 0 ? "Ningún bloque de tus flujos usa esas claves." : `Estos bloques pasan a usar {${keep}}`}</strong>
              {preview.blocks.slice(0, 8).map((block) => (
                <div key={`${block.flowKey}:${block.blockId}:${block.key}:${block.role}`} className="ft-block">
                  <span><strong>{block.blockName}</strong><span>Flujo «{block.flowName}»</span></span>
                  <span className="ft-block__change"><s>{`{${block.key}}`}</s> → <code>{`{${keep}}`}</code></span>
                </div>
              ))}
              {preview.blocks.length > 8 ? <span className="ui-muted">y {preview.blocks.length - 8} más.</span> : null}
            </section>
            <div className="ft-summary">
              <strong>Si un cliente tiene más de uno</strong>
              <span>Se queda el más reciente. {preview.conflicts === 0 ? "Ningún cliente está en ese caso." : `${clients(preview.conflicts)} ${preview.conflicts === 1 ? "está" : "están"} en ese caso.`}</span>
              <span className="ui-muted">Las conversaciones en curso terminan con el nombre viejo. Lo puedes deshacer durante 7 días.</span>
            </div>
          </>
        ) : null}
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="button" className="ui-btn ui-btn--primary" disabled={merge.length === 0 || !preview || busy} onClick={() => void submit()}>
            {busy ? "Uniendo…" : blockCount > 0 ? `Unir y actualizar ${blockCount} ${blockCount === 1 ? "bloque" : "bloques"}` : "Unir campos"}
          </button>
        </div>
      </div>
    </div>
  );
}
