import "./recipients-table.css";
import "../list/broadcast-row.css";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { RecipientFilter, RecipientsPage, RecipientView } from "@contracts/BroadcastResultsContracts";
import { formatMoney } from "@shared/format/formatMoney";
import { formatPhone } from "@shared/phone/formatPhone";
import { timeAgo } from "@shared/format/timeAgo";
import { PillTabs } from "@shared/ui/pill-tabs/PillTabs";
import { broadcastsApi } from "../services/broadcastsApi";
import { count, RECIPIENT_STATE, VARIANT_LETTERS } from "../broadcastFormat";

const TABS: ReadonlyArray<readonly [RecipientFilter, string]> = [["all", "Todos"], ["bought", "Compraron"], ["replied", "Respondieron"], ["read", "Leyeron"], ["unread", "Sin leer"], ["failed", "Fallaron"]];

/** Cada persona con su estado; los que compraron primero. Se abre su chat desde aquí. */
export function RecipientsTable({ broadcastId, refreshKey }: { readonly broadcastId: string; readonly refreshKey: number }) {
  const [filter, setFilter] = useState<RecipientFilter>("all");
  const [page, setPage] = useState<RecipientsPage | null>(null);
  const [rows, setRows] = useState<RecipientView[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void broadcastsApi.recipients(broadcastId, filter).then((first) => {
      if (cancelled) return;
      setPage(first);
      setRows([...first.recipients]);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [broadcastId, filter, refreshKey]);

  const more = async () => {
    if (!page?.nextOffset) return;
    setLoadingMore(true);
    const next = await broadcastsApi.recipients(broadcastId, filter, page.nextOffset).catch(() => null);
    if (next) {
      setPage(next);
      setRows((current) => [...current, ...next.recipients]);
    }
    setLoadingMore(false);
  };

  return (
    <section className="bc-people" aria-label="Cada persona">
      <div className="bc-people__bar">
        <h2>Cada persona</h2>
        <PillTabs label="Filtrar personas" tabs={TABS.map(([id, label]) => ({ id, label, ...(page ? { count: page.counts[id] } : {}) }))} selected={filter} onSelect={setFilter} />
      </div>
      <div className="bc-people__table" role="table" aria-label="Personas de la difusión">
        <div className="bc-people__row bc-people__row--head" role="row">
          <span role="columnheader">Cliente</span>
          <span role="columnheader">Número</span>
          <span role="columnheader">Estado</span>
          <span role="columnheader">Cuándo</span>
          <span role="columnheader" className="bc-people__right">Resultado</span>
        </div>
        {rows.map((person) => {
          const state = RECIPIENT_STATE[person.state];
          const phone = formatPhone(person.phone);
          return (
            <div key={person.id} className="bc-people__row" role="row">
              <span role="cell" className="bc-people__who">
                <strong>{person.name ?? "Sin nombre"}</strong>
                {person.variant !== null ? <small>Versión {VARIANT_LETTERS[person.variant]}</small> : null}
              </span>
              <span role="cell" className="ui-muted">{phone.flag} {phone.text}</span>
              <span role="cell"><span className={`bc-badge bc-badge--${state.tone}`}>{state.label}</span></span>
              <span role="cell" className="ui-muted">{person.sentAt ? timeAgo(person.sentAt) : "—"}</span>
              <span role="cell" className="bc-people__right">
                {person.sale ? <strong className="bc-people__sale">{formatMoney(person.sale.amount, person.sale.currency)}</strong> : null}
                {person.error ? <span className="bc-people__error">{person.error}</span> : null}
                {!person.sale && !person.error && person.state !== "pending" ? <Link className="ui-link" to={`/conversations?search=${person.phone}`}>Abrir chat →</Link> : null}
              </span>
            </div>
          );
        })}
        {page && rows.length === 0 ? <p className="ui-muted bc-people__empty">Nadie aquí todavía.</p> : null}
      </div>
      {page?.nextOffset ? (
        <button type="button" className="ui-btn bc-people__more" disabled={loadingMore} onClick={() => void more()}>
          {loadingMore ? "Cargando…" : `Ver más (${count(page.counts[filter] - rows.length)})`}
        </button>
      ) : null}
    </section>
  );
}
