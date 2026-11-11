import "./campaign-detail.css";
import "../overview/groups-overview.css";
import { groupsApi } from "../services/groupsApi";
import { CampaignFunnel } from "./CampaignFunnel";
import { CampaignGroups } from "./CampaignGroups";
import { CampaignLink } from "./CampaignLink";
import { CampaignPosts } from "./CampaignPosts";
import { CampaignRules } from "./CampaignRules";
import { useCampaignDetail } from "./useCampaignDetail";

/** Una campaña por dentro: el enlace, del clic a la venta, sus grupos, lo automático y los envíos. */
export function CampaignDetail({ id, onBack, onEdit, onSend }: { readonly id: string; readonly onBack: () => void; readonly onEdit: () => void; readonly onSend: () => void }) {
  const { data, status, actionError, run } = useCampaignDetail(id);
  if (!data) {
    return (
      <div className="ui-page gr-detail">
        <button type="button" className="ui-link" onClick={onBack}>← Grupos</button>
        <p className={status === "loading" ? "ui-muted" : "ui-error"} role={status === "loading" ? undefined : "alert"}>
          {status === "loading" ? "Cargando…" : status === "missing" ? "Esa campaña no existe." : "No pudimos cargar la campaña."}
        </p>
      </div>
    );
  }
  const { campaign, canManage } = data;
  const open = campaign.status === "active";
  return (
    <div className="ui-page gr-detail">
      <header className="gr-detail__header">
        <div className="gr-detail__title">
          <button type="button" className="gr-detail__back" onClick={onBack} aria-label="Volver a Grupos">←</button>
          <div>
            <div className="gr-detail__name">
              <h1 className="ui-page__title">{campaign.name}</h1>
              <span className={`gr-badge gr-badge--${open ? "live" : "soon"}`}>{open ? (campaign.current ? "Llenando" : "Abriendo grupo") : "Enlace apagado"}</span>
            </div>
            <p className="ui-page__subtitle">{campaign.groups.length} {campaign.groups.length === 1 ? "grupo" : "grupos"} · por {campaign.connections.map((c) => c.name).join(", ")} · cupo de {campaign.capacity} por grupo</p>
          </div>
        </div>
        {canManage ? (
          <div className="gr-detail__actions">
            <button type="button" className="ui-btn ui-btn--primary" disabled={campaign.groups.length === 0} onClick={onSend}>Enviar a los grupos</button>
            <button type="button" className="ui-btn" onClick={onEdit}>Editar</button>
            <button type="button" className="ui-btn" onClick={() => void run(() => groupsApi.setOpen(id, !open), "No se pudo cambiar el enlace.")}>{open ? "Apagar el enlace" : "Encender el enlace"}</button>
          </div>
        ) : null}
      </header>
      {actionError ? <p className="ui-error" role="alert">{actionError}</p> : null}
      <CampaignLink campaign={campaign} />
      <CampaignFunnel stats={campaign.stats} daily={data.daily} />
      <CampaignGroups groups={data.groups} capacity={campaign.capacity} open={open} />
      <div className="gr-detail__columns">
        <CampaignRules campaign={campaign} canManage={canManage} onEdit={onEdit} />
        <CampaignPosts posts={data.posts} canManage={canManage} onSend={onSend} onCancel={(postId) => void run(() => groupsApi.cancelPost(postId), "No se pudo cancelar el envío.")} />
      </div>
    </div>
  );
}
