import "./follow-ups.css";
import type { FollowUpSummary } from "@contracts/CrmActivityContracts";
import { dueLabel, timeAgo } from "../crmFormat";

/** Un seguimiento: el círculo para marcarlo hecho, qué es, de quién y cuándo. */
export function FollowUpItem({
  followUp,
  canWrite,
  showContact,
  onToggle,
  onOpenContact
}: {
  readonly followUp: FollowUpSummary;
  readonly canWrite: boolean;
  readonly showContact?: boolean;
  readonly onToggle: (followUp: FollowUpSummary) => void;
  readonly onOpenContact?: (contactId: string) => void;
}) {
  const done = followUp.doneAt !== null;
  const due = dueLabel(followUp.dueAt);
  return (
    <li className={`follow-up${done ? " follow-up--done" : ""}${!done && due.tone === "today" ? " follow-up--today" : ""}`}>
      <button
        type="button"
        className="follow-up__check"
        aria-pressed={done}
        aria-label={done ? `Marcar «${followUp.title}» como pendiente` : `Marcar «${followUp.title}» como hecho`}
        disabled={!canWrite}
        onClick={() => onToggle(followUp)}
      >
        {done ? (
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
        ) : null}
      </button>
      <span className="follow-up__text">
        <span className="follow-up__title">{followUp.title}</span>
        <span className="follow-up__meta">
          {showContact && onOpenContact ? (
            <button type="button" className="ui-link follow-up__contact" onClick={() => onOpenContact(followUp.contactId)}>{followUp.contactName ?? "Cliente"}</button>
          ) : null}
          {showContact ? " · " : ""}
          {done ? `Hecho ${timeAgo(followUp.doneAt)}${followUp.doneByName ? ` por ${followUp.doneByName}` : ""}` : (followUp.assigneeName ?? "Sin responsable")}
        </span>
      </span>
      {done ? null : <span className={`follow-up__due follow-up__due--${due.tone}`}>{due.text}</span>}
    </li>
  );
}
