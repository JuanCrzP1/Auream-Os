import "@shared/ui/controls/controls.css";
import "./group-members.css";
import { useEffect, useId, useState } from "react";
import type { GroupMemberFilter } from "@contracts/GroupMemberContracts";
import { PillTabs } from "@shared/ui/pill-tabs/PillTabs";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { timeAgo } from "@shared/format/timeAgo";
import { count, money } from "../groupsFormat";
import { groupsApi } from "../services/groupsApi";
import { DownloadMembersButton } from "./DownloadMembersButton";
import { LabelMembers } from "./LabelMembers";
import { MembersList } from "./MembersList";
import { useGroupMembers } from "./useGroupMembers";

const TABS: ReadonlyArray<readonly [GroupMemberFilter, string]> = [["all", "Todos"], ["buyers", "Compraron"], ["nonBuyers", "No compraron"], ["left", "Salieron"], ["admins", "Admins"]];

/**
 * Los miembros de un grupo en un panel a la derecha: cuántos están, quién
 * compró mientras estaba (lo mismo que la tarjeta del grupo) y quién se fue.
 * Con ellos se actúa: ponerles una etiqueta o descargarlos.
 */
export function GroupMembersPanel({ groupId, groupName, onClose }: { readonly groupId: string; readonly groupName: string; readonly onClose: () => void }) {
  const titleId = useId();
  const members = useGroupMembers(groupId);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const { page, summary, filter } = members;

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);

  const sync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      await groupsApi.sync();
      members.reload();
    } catch (cause) {
      setSyncError(apiErrorMessage(cause, "No se pudieron traer los grupos de WhatsApp."));
    } finally {
      setSyncing(false);
    }
  };

  const people = page?.counts[filter] ?? 0;
  const revenue = summary?.revenue ?? null;
  return (
    <div className="ui-overlay gr-members__overlay" onClick={onClose}>
      <aside className="gr-members" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <header className="gr-members__header">
          <div className="gr-members__top">
            <span className="gr-members__kicker">Miembros</span>
            <button type="button" className="gr-members__close" aria-label="Cerrar" onClick={onClose}>×</button>
          </div>
          <h2 id={titleId}>{summary?.group.name ?? groupName}</h2>
          <span className="ui-muted gr-members__sub">
            {summary ? `${summary.group.connectionName} · ${summary.group.syncedAt ? `actualizado ${timeAgo(summary.group.syncedAt)}` : "sin traer de WhatsApp todavía"}` : ""}
            {summary?.canExport ? <button type="button" className="ui-link gr-members__sync" disabled={syncing} onClick={() => void sync()}>{syncing ? "Trayendo…" : "↻ Traer de WhatsApp"}</button> : null}
          </span>
          {summary ? (
            <dl className="gr-members__stats">
              <div><dt>En el grupo</dt><dd>{count(summary.group.members)}</dd></div>
              <div><dt>Compraron</dt><dd>{count(summary.counts.buyers)}{revenue && revenue.length > 0 ? <small>{money(revenue).main}{money(revenue).others > 0 ? ` +${money(revenue).others}` : ""}</small> : null}</dd></div>
              <div><dt>Salieron</dt><dd>{count(summary.counts.left)}</dd></div>
            </dl>
          ) : null}
          {summary && summary.hidden > 0 ? (
            <p className="ui-muted gr-members__hidden">
              Se listan los {count(summary.counts.all)} con número visible. WhatsApp oculta el número de {count(summary.hidden)}: no se pueden cruzar con ventas.
            </p>
          ) : null}
        </header>
        <div className="gr-members__body">
          {syncError || members.error ? <p className="ui-error" role="alert">{syncError ?? members.error}</p> : null}
          <PillTabs label="Filtrar miembros" tabs={TABS.map(([id, label]) => ({ id, label, ...(page ? { count: page.counts[id] } : {}) }))} selected={filter} onSelect={members.setFilter} />
          <input className="ui-input gr-members__search" type="search" placeholder="Buscar por nombre o número" aria-label="Buscar miembros" value={members.search} onChange={(event) => members.setSearch(event.target.value)} />
          {page && (page.canLabel || page.canExport) ? (
            <div className="gr-members__actions">
              {page.canLabel ? <LabelMembers key={`label-${filter}`} groupId={groupId} groupName={page.group.name} filter={filter} people={people} disabled={members.searching} onLabeled={members.reload} /> : null}
              {page.canExport ? <DownloadMembersButton key={`download-${filter}`} groupId={groupId} filter={filter} people={people} disabled={members.searching} /> : null}
            </div>
          ) : null}
          <MembersList rows={members.rows} total={people} loaded={page !== null} hasMore={page?.nextOffset !== null && page?.nextOffset !== undefined} loadingMore={members.loadingMore} onMore={() => void members.more()} />
        </div>
      </aside>
    </div>
  );
}
