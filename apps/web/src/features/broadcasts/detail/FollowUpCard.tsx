import "./detail-cards.css";
import type { BroadcastSummary } from "@contracts/BroadcastResultsContracts";
import { readable, when } from "../broadcastFormat";

const hoursText = (hours: number) => (hours % 24 === 0 ? `${hours / 24} ${hours === 24 ? "día" : "días"}` : `${hours} horas`);

/** El segundo envío (o, si esta ES el segundo envío, de cuál viene). */
export function FollowUpCard({ broadcast, onOpen }: { readonly broadcast: BroadcastSummary; readonly onOpen?: (id: string) => void }) {
  if (broadcast.parentId) {
    return (
      <section className="bc-card bc-card--row" aria-label="Segundo envío">
        <span>Es el segundo envío de <strong>«{broadcast.parentName ?? "otra difusión"}»</strong>: solo a quien no respondió, ni compró, ni pidió salir.</span>
        {onOpen ? <button type="button" className="ui-btn" onClick={() => onOpen(broadcast.parentId!)}>Ver la primera</button> : null}
      </section>
    );
  }
  const followUp = broadcast.followUp!;
  const text = followUp.content.kind === "message" ? followUp.content.text : "un flujo";
  const status = followUp.childId ? "Ya salió." : followUp.dueAt ? `Sale ${when(followUp.dueAt)}.` : `Sale ${hoursText(followUp.afterHours)} después de terminar esta.`;
  return (
    <section className="bc-card bc-card--row" aria-label="Segundo envío">
      <div>
        <strong>Segundo envío a los que no respondieron</strong>
        <p className="ui-muted">{status} «{readable(text).slice(0, 120)}»</p>
      </div>
      {followUp.childId && onOpen ? <button type="button" className="ui-btn" onClick={() => onOpen(followUp.childId!)}>Ver resultados</button> : null}
    </section>
  );
}
