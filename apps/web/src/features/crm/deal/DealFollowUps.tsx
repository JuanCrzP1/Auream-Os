import "../follow-ups/follow-ups.css";
import type { FollowUpSummary } from "@contracts/CrmActivityContracts";
import { FollowUpComposer } from "../follow-ups/FollowUpComposer";
import { FollowUpItem } from "../follow-ups/FollowUpItem";
import { crmApi } from "../services/crmApi";

/** Los seguimientos de un cliente (pendientes primero) y el formulario para agregar otro. */
export function DealFollowUps({ contactId, followUps, canWrite, onChanged }: {
  readonly contactId: string;
  readonly followUps: ReadonlyArray<FollowUpSummary>;
  readonly canWrite: boolean;
  readonly onChanged: () => void;
}) {
  return (
    <section className="deal-drawer__section" aria-label="Seguimientos">
      <h3>Seguimientos</h3>
      {followUps.length === 0 ? <p className="ui-muted deal-drawer__note">Sin seguimientos todavía.</p> : null}
      <ul className="follow-up-list">
        {followUps.slice(0, 8).map((followUp) => (
          <FollowUpItem
            key={followUp.id}
            followUp={followUp}
            canWrite={canWrite}
            onToggle={(item) => void crmApi.updateFollowUp(item.id, { done: item.doneAt === null }).then(onChanged)}
          />
        ))}
      </ul>
      {canWrite ? (
        <FollowUpComposer
          onCreate={async (title, dueAt) => {
            await crmApi.createFollowUp({ contactId, title, dueAt });
            onChanged();
          }}
        />
      ) : null}
    </section>
  );
}
