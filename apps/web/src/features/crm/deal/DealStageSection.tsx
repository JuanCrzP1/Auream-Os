import "./deal-stage.css";
import type { CrmMember, PipelineSummary } from "@contracts/CrmContracts";
import type { ContactDeal } from "@contracts/CrmActivityContracts";
import type { ProductSummary } from "@contracts/SalesContracts";
import { timeAgo } from "../crmFormat";
import { MoveMenu } from "../pipeline/MoveMenu";
import { DealValueEditor } from "./DealValueEditor";

/**
 * El cliente en un embudo: la barra de etapas con la suya resaltada, el paso
 * siguiente a un toque («Mover a Pagó →», «No compró»), su valor y quién lo atiende.
 */
export function DealStageSection({
  deal,
  pipeline,
  members,
  products,
  canWrite,
  onMove,
  onUpdate
}: {
  readonly deal: ContactDeal;
  readonly pipeline: PipelineSummary;
  readonly members: ReadonlyArray<CrmMember>;
  readonly products: ReadonlyArray<ProductSummary>;
  readonly canWrite: boolean;
  readonly onMove: (stageId: string) => void;
  readonly onUpdate: (change: { amount?: string | null; currency?: string | null; productId?: string | null; ownerId?: string | null }) => Promise<void>;
}) {
  const funnel = pipeline.stages.filter((stage) => stage.outcome !== "lost");
  const current = pipeline.stages.find((stage) => stage.id === deal.stageId);
  const index = funnel.findIndex((stage) => stage.id === deal.stageId);
  const next = index >= 0 ? funnel[index + 1] : funnel[0];
  const lost = pipeline.stages.find((stage) => stage.outcome === "lost");

  return (
    <section className="deal-stage" aria-label={`Etapa en ${pipeline.name}`}>
      <header className="deal-stage__header">
        <h3>Etapa · {pipeline.name}</h3>
        {deal.enteredAt ? <span>{timeAgo(deal.enteredAt)} en esta etapa</span> : null}
      </header>
      <div className="deal-stage__bar" style={{ ["--stages" as string]: funnel.length }} aria-hidden="true">
        {funnel.map((stage, i) => (
          <span key={stage.id} className={`deal-stage__segment${i === index ? " deal-stage__segment--current" : ""}`} style={{ background: index >= 0 && i <= index ? stage.color : undefined }} />
        ))}
      </div>
      <div className="deal-stage__names" style={{ ["--stages" as string]: funnel.length }}>
        {funnel.map((stage) => (
          <span key={stage.id} className={stage.id === deal.stageId ? "deal-stage__name--current" : undefined}>{stage.name}</span>
        ))}
      </div>
      {current?.outcome === "lost" ? <p className="deal-stage__lost">Está en «{current.name}».</p> : null}
      {canWrite ? (
        <div className="deal-stage__actions">
          {next ? <button type="button" className="deal-stage__next" onClick={() => onMove(next.id)}>Mover a {next.name} →</button> : null}
          {lost && current?.outcome !== "lost" ? <button type="button" className="deal-stage__lose" onClick={() => onMove(lost.id)}>No compró</button> : null}
          <MoveMenu stages={pipeline.stages} currentStageId={deal.stageId ?? ""} label="Mover a otra etapa" onMove={onMove} />
        </div>
      ) : null}
      <div className="deal-stage__grid">
        <DealValueEditor deal={deal} products={products} canWrite={canWrite} onSave={onUpdate} />
        <label className="deal-stage__card">
          <span className="deal-stage__label">Responsable</span>
          <select className="ui-input" value={deal.ownerId ?? ""} disabled={!canWrite} onChange={(event) => void onUpdate({ ownerId: event.target.value || null })}>
            <option value="">Sin responsable</option>
            {members.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}
          </select>
        </label>
      </div>
    </section>
  );
}
