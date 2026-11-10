import "@shared/ui/controls/controls.css";
import "./deal-drawer.css";
import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import type { ContactSummary } from "@contracts/ContactContracts";
import type { CrmMember, PipelineSummary } from "@contracts/CrmContracts";
import type { ProductSummary } from "@contracts/SalesContracts";
import { countryOfPhone } from "@contracts/Countries";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { initialsOf } from "../crmFormat";
import { fetchContact } from "../contacts/services/contactsApi";
import { LostReasonDialog } from "../pipeline/LostReasonDialog";
import { crmApi } from "../services/crmApi";
import { DealFollowUps } from "./DealFollowUps";
import { DealHistory } from "./DealHistory";
import { DealStageSection } from "./DealStageSection";
import { useContactCrm } from "./useContactCrm";

/**
 * La ficha del cliente en el CRM: en qué etapa va en cada embudo (y el paso
 * siguiente a un toque), su valor y responsable, sus seguimientos, sus
 * etiquetas y todo lo que le ha pasado. Se abre desde el tablero, la lista o
 * un seguimiento; cada cambio refresca el tablero.
 */
export function DealDrawer({ contactId, pipelines, members, products, canWrite, onChanged, onClose }: {
  readonly contactId: string;
  readonly pipelines: ReadonlyArray<PipelineSummary>;
  readonly members: ReadonlyArray<CrmMember>;
  readonly products: ReadonlyArray<ProductSummary>;
  readonly canWrite: boolean;
  readonly onChanged: () => void;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const crm = useContactCrm(contactId);
  const [contact, setContact] = useState<ContactSummary | null>(null);
  const [lost, setLost] = useState<{ pipelineId: string; stageId: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchContact(contactId).then(setContact).catch(() => setContact(null));
  }, [contactId, crm.data]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && !lost && onClose();
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [lost, onClose]);

  const run = async (work: () => Promise<unknown>, fallback: string) => {
    setError(null);
    try {
      await work();
      await crm.reload();
      onChanged();
    } catch (e) {
      setError(apiErrorMessage(e, fallback));
    }
  };
  const move = (pipelineId: string, stageId: string, reason?: string) => run(() => crmApi.move(pipelineId, contactId, { stageId, ...(reason ? { reason } : {}) }), "No se pudo mover al cliente.");
  const requestMove = (pipeline: PipelineSummary, stageId: string) => {
    const stage = pipeline.stages.find((candidate) => candidate.id === stageId);
    if (stage?.outcome === "lost") setLost({ pipelineId: pipeline.id, stageId, name: stage.name });
    else void move(pipeline.id, stageId);
  };

  const name = contact?.name ?? (contact?.phone ? `+${contact.phone}` : "Cliente");
  const country = countryOfPhone(contact?.phone ?? null);
  const deals = crm.data?.deals ?? [];
  const outside = pipelines.filter((pipeline) => !deals.some((deal) => deal.pipelineId === pipeline.id));

  return (
    <>
      <div className="ui-overlay deal-drawer__overlay" onClick={onClose}>
        <aside className="deal-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
          <header className="deal-drawer__header">
            <div className="deal-drawer__top">
              <span className="deal-drawer__kicker">Cliente</span>
              <button type="button" className="deal-drawer__close" aria-label="Cerrar" onClick={onClose}>×</button>
            </div>
            <div className="deal-drawer__who">
              <span className="deal-drawer__ring" aria-hidden="true"><span>{initialsOf(contact?.name ?? null, contact?.phone ?? null)}</span></span>
              <div>
                <h2 id={titleId}>{name}{country ? <span className="deal-drawer__country">{country}</span> : null}</h2>
                <span className="deal-drawer__phone">{contact?.phone ? `+${contact.phone}` : ""}</span>
              </div>
            </div>
            {contact?.phone ? <Link className="ui-btn ui-btn--primary deal-drawer__chat" to={`/conversations?search=${encodeURIComponent(contact.phone)}`}>Abrir chat</Link> : null}
          </header>
          <div className="deal-drawer__body">
            {error ? <p className="ui-error" role="alert">{error}</p> : null}
            {crm.failed ? <p className="ui-error" role="alert">No pudimos cargar la ficha. Vuelve a intentarlo.</p> : null}
            {deals.map((deal) => {
              const pipeline = pipelines.find((candidate) => candidate.id === deal.pipelineId);
              return pipeline ? (
                <DealStageSection
                  key={deal.pipelineId}
                  deal={deal}
                  pipeline={pipeline}
                  members={members}
                  products={products}
                  canWrite={canWrite}
                  onMove={(stageId) => requestMove(pipeline, stageId)}
                  onUpdate={(change) => run(() => crmApi.updateDeal(pipeline.id, contactId, change), "No se pudo guardar.")}
                />
              ) : null;
            })}
            {crm.data && canWrite && outside.length > 0 ? (
              <div className="deal-drawer__outside">
                {deals.length === 0 ? <p className="ui-muted">No está en ningún embudo.</p> : null}
                {outside.map((pipeline) => {
                  const first = pipeline.stages.find((stage) => stage.outcome === "open");
                  return first ? <button key={pipeline.id} type="button" className="ui-btn ui-btn--ghost" onClick={() => void move(pipeline.id, first.id)}>Agregar a «{pipeline.name}»</button> : null;
                })}
              </div>
            ) : null}
            <DealFollowUps contactId={contactId} followUps={crm.data?.followUps ?? []} canWrite={canWrite} onChanged={() => void run(async () => undefined, "")} />
            {contact && contact.labels.length > 0 ? (
              <section className="deal-drawer__section" aria-label="Etiquetas">
                <h3>Etiquetas</h3>
                <div className="deal-drawer__labels">
                  {contact.labels.map((label) => <span key={label.id} className="deal-drawer__label" style={{ ["--label-color" as string]: label.color }}>{label.name}</span>)}
                </div>
              </section>
            ) : null}
            <section className="deal-drawer__section" aria-label="Historial">
              <h3>Historial</h3>
              <DealHistory events={crm.data?.events ?? []} pipelines={pipelines} />
            </section>
          </div>
        </aside>
      </div>
      {/* Fuera del fondo de la ficha: tocar fuera del motivo no cierra la ficha. */}
      {lost ? (
        <LostReasonDialog
          stageName={lost.name}
          onClose={() => setLost(null)}
          onConfirm={(reason) => {
            const target = lost;
            setLost(null);
            void move(target.pipelineId, target.stageId, reason);
          }}
        />
      ) : null}
    </>
  );
}
