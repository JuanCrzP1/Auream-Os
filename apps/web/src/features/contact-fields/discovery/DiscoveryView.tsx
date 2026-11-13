import "./discovery.css";
import { useCallback, useEffect, useState } from "react";
import type { AdoptFieldsRequest, DiscoveredField } from "@contracts/ContactFieldContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { RetryButton, StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { discoverContactFields } from "@shared/contact-fields/contactFieldsApi";
import { choiceFor, DiscoveryRow, type Choice } from "./DiscoveryRow";

/** El servidor convierte hasta 50 a la vez. */
const MAX_AT_ONCE = 50;

type Found = { readonly status: "loading" } | { readonly status: "error" } | { readonly status: "ready"; readonly fields: ReadonlyArray<DiscoveredField> };

/**
 * El primer día: los datos que tus flujos, integraciones o tu equipo ya
 * guardan y aún no son campos, con el nombre y el tipo que proponemos. Quien
 * revisa elige cuáles convertir; los técnicos quedan aparte y sin marcar.
 * Los flujos no cambian: los datos solo ganan nombre, tipo y lugar en la ficha.
 */
export function DiscoveryView({ total, onAdopt, onClose }: { readonly total: number; readonly onAdopt: (request: AdoptFieldsRequest) => Promise<unknown>; readonly onClose: () => void }) {
  const [found, setFound] = useState<Found>({ status: "loading" });
  const [choices, setChoices] = useState<Readonly<Record<string, Choice>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFound({ status: "loading" });
    try {
      const { suggestions } = await discoverContactFields();
      setChoices(Object.fromEntries(suggestions.map((field) => [field.key, choiceFor(field)])));
      setFound({ status: "ready", fields: suggestions });
    } catch {
      setFound({ status: "error" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (found.status === "loading") return <div className="cf-loading" aria-busy="true" aria-label="Buscando lo que tus flujos ya guardan" />;
  if (found.status === "error") {
    return <StateCard role="alert" tone="warning" icon={StateIcons.offline} title="No pudimos revisar tus flujos" description="Revisa tu conexión e inténtalo de nuevo." actions={<RetryButton busy={false} onRetry={() => void load()} />} />;
  }

  const useful = found.fields.filter((field) => !field.technical);
  const technical = found.fields.filter((field) => field.technical);
  const picked = found.fields.filter((field) => choices[field.key]?.on);
  const tooMany = picked.length > MAX_AT_ONCE;
  const row = (field: DiscoveredField) => (
    <DiscoveryRow key={field.key} field={field} choice={choices[field.key] ?? choiceFor(field)} onChange={(choice) => setChoices((current) => ({ ...current, [field.key]: choice }))} />
  );

  const convert = async () => {
    setBusy(true);
    setError(null);
    try {
      await onAdopt({
        fields: picked.map((field) => {
          const choice = choices[field.key]!;
          return { key: field.key, label: choice.label.trim(), type: choice.type, ...(choice.type === "list" ? { options: field.suggestedOptions } : {}) };
        })
      });
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudieron convertir. Nada cambió."));
      setBusy(false);
    }
  };

  return (
    <section className="cf-discovery" aria-label="Lo que tus flujos ya guardan">
      <header className="cf-discovery__hero">
        <h2>{useful.length === 0 ? "No hay datos de clientes por ordenar" : useful.length === 1 ? "Tus flujos ya guardan 1 dato de tus clientes" : `Tus flujos ya guardan ${useful.length} datos de tus clientes`}</h2>
        <p>Los encontramos en tus bloques y en {total === 1 ? "tu cliente" : `tus ${total.toLocaleString("es-CO")} clientes`}. Revisa lo que proponemos y conviértelos en campos con tipo: así se ven en la ficha, se usan en condiciones y no se escriben a mano.</p>
      </header>
      {found.fields.length === 0 ? (
        <p className="cf-discovery__empty">No hay datos por ordenar: todo lo que guardan tus flujos ya es un campo.</p>
      ) : (
        <div className="cf-discovery__table">
          <div className="cf-discovery__head" aria-hidden="true"><span /><span>Lo que guardan</span><span>Proponemos</span><span>Tipo</span><span>Clientes con dato</span></div>
          <ul className="cf-discovery__rows">{useful.map(row)}</ul>
          {technical.length > 0 ? (
            <details className="cf-discovery__technical">
              <summary>
                <strong>{technical.length === 1 ? "1 dato técnico de integraciones" : `${technical.length} datos técnicos de integraciones`}</strong>
                <span>Ids, estados y errores. Siguen funcionando en los flujos; no hace falta convertirlos.</span>
              </summary>
              <ul className="cf-discovery__rows">{technical.map(row)}</ul>
            </details>
          ) : null}
        </div>
      )}
      {tooMany ? <p className="ui-error" role="alert">Convierte hasta {MAX_AT_ONCE} a la vez: desmarca {picked.length - MAX_AT_ONCE}.</p> : null}
      {error ? <p className="ui-error" role="alert">{error}</p> : null}
      <footer className="cf-discovery__footer">
        <span>Tus flujos siguen igual: solo ganan nombre, tipo y lugar en la ficha.</span>
        <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>Ahora no</button>
        <button type="button" className="ui-btn ui-btn--primary" disabled={picked.length === 0 || tooMany || busy} onClick={() => void convert()}>
          {busy ? "Convirtiendo…" : picked.length === 1 ? "Convertir 1 en campo" : `Convertir ${picked.length} en campos`}
        </button>
      </footer>
    </section>
  );
}
