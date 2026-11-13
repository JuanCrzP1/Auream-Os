import "./field-tools.css";
import { useEffect, useId, useMemo, useState } from "react";
import type { FieldOperationResponse, FieldValueGroup, FieldValuesResponse } from "@contracts/ContactFieldToolsContracts";
import { fetchFieldValues, tidyField } from "@shared/contact-fields/contactFieldsApi";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { clients } from "../fieldText";

// ---------------------------------------------------------------------------
// «Ordenar valores»: lo que los clientes escribieron de varias formas, en
// grupos, con lo que proponemos para cada uno. La persona revisa, cambia lo
// que quiera y confirma: nada cambia antes, y se puede deshacer.
// ---------------------------------------------------------------------------

/** Lo elegido para un grupo: una opción (existente o nueva), dejarlo como está o dejarlo sin dato. */
type Choice = { readonly kind: "to"; readonly to: string } | { readonly kind: "keep" } | { readonly kind: "clear" };

const KEEP = "__keep";
const CLEAR = "__clear";
const startChoice = (group: FieldValueGroup): Choice => (group.proposal.kind === "keep" ? { kind: "keep" } : { kind: "to", to: group.proposal.to });
/** Clientes cuyo dato cambia en un grupo con lo elegido. */
const changed = (group: FieldValueGroup, choice: Choice) =>
  choice.kind === "keep" ? 0 : group.values.filter((entry) => choice.kind === "clear" || entry.value !== choice.to).reduce((sum, entry) => sum + entry.count, 0);

export function TidyDialog({ fieldId, onDone, onClose }: { readonly fieldId: string; readonly onDone: (result: FieldOperationResponse) => void; readonly onClose: () => void }) {
  const titleId = useId();
  const [data, setData] = useState<FieldValuesResponse | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchFieldValues(fieldId).then(
      (values) => {
        if (!alive) return;
        setData(values);
        setChoices(values.groups.map(startChoice));
      },
      (failure) => alive && setError(apiErrorMessage(failure, "No pudimos leer los valores de este campo."))
    );
    return () => {
      alive = false;
    };
  }, [fieldId]);

  // Las opciones entre las que se elige: las del campo y las nuevas que ya se eligieron en algún grupo.
  const options = useMemo(() => {
    const all = [...(data?.type === "list" ? data.options : [])];
    for (const choice of choices) if (choice.kind === "to" && !all.includes(choice.to)) all.push(choice.to);
    return all;
  }, [data, choices]);
  const total = data ? data.groups.reduce((sum, group, index) => sum + changed(group, choices[index] ?? { kind: "keep" }), 0) : 0;
  const cleared = data ? data.groups.reduce((sum, group, index) => sum + (choices[index]?.kind === "clear" ? group.count : 0), 0) : 0;
  const added = options.length - (data?.type === "list" ? data.options.length : 0);
  const ready = data !== null && options.length >= 2 && (total > 0 || added > 0);

  const submit = async () => {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      const assignments = data.groups
        .map((group, index) => ({ group, choice: choices[index]! }))
        .filter(({ choice }) => choice.kind !== "keep")
        .map(({ group, choice }) => ({ values: group.values.map((entry) => entry.value), to: choice.kind === "to" ? choice.to : null }));
      onDone(await tidyField(fieldId, { assignments }));
      onClose();
    } catch (failure) {
      setError(apiErrorMessage(failure, "No se pudo ordenar. Nada cambió."));
      setBusy(false);
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <div className="ui-dialog ft-dialog" onClick={(event) => event.stopPropagation()}>
        <div>
          <h2 id={titleId}>Ordenar «{data?.label ?? "…"}»</h2>
          <p className="ui-muted">
            {data ? `Tus clientes lo escribieron de ${data.distinct} ${data.distinct === 1 ? "forma" : "formas"}. Revisa cómo los agrupamos, cambia lo que quieras y confirma. Nada cambia antes.` : "Leyendo lo que escribieron tus clientes…"}
          </p>
        </div>
        {data ? (
          <div className="ft-groups" role="list">
            {data.groups.map((group, index) => {
              const choice = choices[index] ?? { kind: "keep" };
              const suggested = group.values[0]!.value.trim();
              const value = choice.kind === "to" ? choice.to : choice.kind === "clear" ? CLEAR : KEEP;
              return (
                <div key={group.values[0]!.value} className={`ft-group${group.proposal.kind === "option" ? "" : " ft-group--unknown"}`} role="listitem">
                  <span className="ft-group__values">
                    {group.values.map((entry) => <span key={entry.value} className="ft-chip">{entry.value} · {entry.count}</span>)}
                  </span>
                  <select
                    className="ui-input"
                    aria-label={`«${suggested}» queda como`}
                    value={value}
                    onChange={(event) => {
                      const picked = event.target.value;
                      setChoices((current) => current.map((old, at) => (at !== index ? old : picked === KEEP ? { kind: "keep" } : picked === CLEAR ? { kind: "clear" } : { kind: "to", to: picked })));
                    }}
                  >
                    {options.map((option) => <option key={option} value={option}>{option}</option>)}
                    {options.includes(suggested) || suggested.length > 40 ? null : <option value={suggested}>+ Nueva opción «{suggested}»</option>}
                    <option value={KEEP}>Dejar como está</option>
                    <option value={CLEAR}>Dejar sin dato</option>
                  </select>
                </div>
              );
            })}
          </div>
        ) : null}
        {data?.truncated ? <p className="ui-muted">Mostramos los {data.groups.length} grupos más usados; los demás quedan como están.</p> : null}
        {data ? (
          <div className="ft-summary" aria-live="polite">
            <strong>Al confirmar</strong>
            <span>· {clients(total)} {total === 1 ? "queda" : "quedan"} con su dato ordenado{cleared > 0 ? ` (${cleared} sin dato)` : ""}.</span>
            <span>· «{data.label}» queda como lista con {options.length} {options.length === 1 ? "opción" : "opciones"}{added > 0 ? ` (${added} ${added === 1 ? "nueva" : "nuevas"})` : ""}.</span>
            <span className="ui-muted">Tus flujos no cambian. Lo puedes deshacer durante 7 días.</span>
          </div>
        ) : null}
        {data && options.length < 2 ? <p className="ui-muted">Una lista necesita al menos 2 opciones: elige a qué opción pasa cada grupo.</p> : null}
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="button" className="ui-btn ui-btn--primary" disabled={!ready || busy} onClick={() => void submit()}>
            {busy ? "Ordenando…" : total > 0 ? `Ordenar ${clients(total)}` : "Convertir en lista"}
          </button>
        </div>
      </div>
    </div>
  );
}
