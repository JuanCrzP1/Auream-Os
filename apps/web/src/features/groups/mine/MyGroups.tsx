import "./my-groups.css";
import { useCallback, useEffect, useState } from "react";
import type { CampaignSummary, GroupListResponse } from "@contracts/GroupContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { timeAgo } from "@shared/format/timeAgo";
import { count, GROUP_STATE, money } from "../groupsFormat";
import { groupsApi } from "../services/groupsApi";

/** Los grupos de tus números conectados: traerlos de WhatsApp y sumarlos a una campaña. */
export function MyGroups({ campaigns, canManage }: { readonly campaigns: ReadonlyArray<CampaignSummary>; readonly canManage: boolean }) {
  const [data, setData] = useState<GroupListResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => setData(await groupsApi.list().catch(() => null)), []);
  useEffect(() => {
    void load();
  }, [load]);

  const sync = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await groupsApi.sync();
      setData(result);
      if (result.failed.length > 0) setNotice(`No se pudo revisar: ${result.failed.join(", ")}.`);
    } catch (error) {
      setNotice(apiErrorMessage(error, "No se pudieron traer los grupos."));
    } finally {
      setBusy(false);
    }
  };

  const attach = async (groupId: string, campaignId: string) => {
    try {
      setData(await groupsApi.attach(groupId, campaignId || null));
    } catch (error) {
      setNotice(apiErrorMessage(error, "No se pudo cambiar la campaña del grupo."));
    }
  };

  const groups = data?.groups ?? [];
  return (
    <section className="gr-mine" aria-label="Mis grupos">
      <div className="gr-mine__bar">
        <span className="ui-muted">Los grupos de tus números conectados por QR. {data?.syncedAt ? `Actualizado ${timeAgo(data.syncedAt)}.` : ""}</span>
        {canManage ? <button type="button" className="ui-btn" disabled={busy} onClick={() => void sync()}>{busy ? "Trayendo de WhatsApp…" : "↻ Traer de WhatsApp"}</button> : null}
      </div>
      {notice ? <p className="ui-error" role="alert">{notice}</p> : null}
      {data && groups.length === 0 ? <p className="ui-muted gr-mine__empty">Aún no hay grupos. {canManage ? "Toca «Traer de WhatsApp» para ver los de tus números." : ""}</p> : null}
      {groups.length > 0 ? (
        <div className="gr-mine__table" role="table" aria-label="Grupos">
          <div className="gr-mine__row gr-mine__row--head" role="row">
            <span role="columnheader">Grupo</span><span role="columnheader">Número</span><span role="columnheader">Miembros</span>
            <span role="columnheader">Entraron · salieron</span><span role="columnheader">Campaña</span><span role="columnheader" className="gr-mine__right">Vendido</span>
          </div>
          {groups.map((group) => (
            <div key={group.id} className="gr-mine__row" role="row">
              <span role="cell" className="gr-mine__name">
                {group.imageUrl ? <img src={group.imageUrl} alt="" /> : <span className="gr-mine__avatar" aria-hidden="true">{group.name.slice(0, 1).toUpperCase()}</span>}
                <span><strong>{group.name || "Sin nombre"}</strong><small>{group.isAdmin ? (group.announce ? "Administras · solo admins escriben" : "Administras") : "No eres administrador"}</small></span>
              </span>
              <span role="cell" className="ui-muted">{group.connectionName}</span>
              <span role="cell">{count(group.members)}</span>
              <span role="cell"><span className="gr-mine__in">+{count(group.joined)}</span> · <span className="gr-mine__out">−{count(group.left)}</span></span>
              <span role="cell">
                {canManage && group.isAdmin ? (
                  <select className="ui-input gr-mine__select" aria-label={`Campaña de ${group.name}`} value={group.campaignId ?? ""} onChange={(event) => void attach(group.id, event.target.value)}>
                    <option value="">Sin campaña</option>
                    {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                  </select>
                ) : (
                  <span className="ui-muted">{group.campaignName ?? GROUP_STATE.other.label}</span>
                )}
              </span>
              <strong role="cell" className="gr-mine__right gr-mine__money">{group.buyers > 0 ? money(group.revenue).main : "—"}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
