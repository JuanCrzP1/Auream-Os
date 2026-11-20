import "./members-list.css";
import { Link } from "react-router-dom";
import type { GroupMemberView } from "@contracts/GroupMemberContracts";
import { formatMoney } from "@shared/format/formatMoney";
import { formatPhone } from "@shared/phone/formatPhone";
import { timeAgo } from "@shared/format/timeAgo";
import { count } from "../groupsFormat";

function initials(member: GroupMemberView): string {
  const words = (member.name ?? "").trim().split(/\s+/).filter(Boolean);
  return words.length > 0 ? words.slice(0, 2).map((word) => word[0]!.toUpperCase()).join("") : "#";
}

function MemberItem({ member }: { readonly member: GroupMemberView }) {
  const phone = formatPhone(member.phone);
  const bought = member.bought ?? [];
  return (
    <li className="gr-members__item">
      <span className="gr-members__avatar" aria-hidden="true">{initials(member)}</span>
      <span className="gr-members__who">
        <strong>{member.name ?? "Sin nombre"}</strong>
        <span className="ui-muted">{phone.flag} {phone.text}</span>
        <span className="gr-members__tags">
          {member.isOwnNumber ? <span className="gr-members__tag gr-members__tag--own">Tu número</span> : null}
          {member.isAdmin ? <span className="gr-members__tag">Admin</span> : null}
        </span>
      </span>
      <span className="gr-members__when ui-muted">
        {member.leftAt ? `Salió ${timeAgo(member.leftAt)}` : member.joinedAt ? `Entró ${timeAgo(member.joinedAt)}` : "Ya estaba"}
      </span>
      <span className="gr-members__result">
        {bought.length > 0 ? (
          <strong className="gr-members__bought">Compró {bought.map((entry) => formatMoney(entry.amount, entry.currency)).join(" · ")}</strong>
        ) : member.isOwnNumber ? null : (
          <Link className="ui-link" to={`/conversations?search=${member.phone}`}>Abrir chat →</Link>
        )}
      </span>
    </li>
  );
}

/** Cada miembro del filtro, los más nuevos primero; «Ver más» trae la siguiente página. */
export function MembersList({ rows, total, loaded, hasMore, loadingMore, onMore }: {
  readonly rows: ReadonlyArray<GroupMemberView>;
  /** Cuántos hay en el filtro (para «Ver más (n)»). */
  readonly total: number;
  readonly loaded: boolean;
  readonly hasMore: boolean;
  readonly loadingMore: boolean;
  readonly onMore: () => void;
}) {
  if (!loaded) return <p className="ui-muted gr-members__empty">Cargando miembros…</p>;
  if (rows.length === 0) return <p className="ui-muted gr-members__empty">Nadie aquí.</p>;
  return (
    <>
      <ul className="gr-members__list" aria-label="Miembros">
        {rows.map((member) => <MemberItem key={member.key} member={member} />)}
      </ul>
      {hasMore ? (
        <button type="button" className="ui-btn gr-members__more" disabled={loadingMore} onClick={onMore}>
          {loadingMore ? "Cargando…" : `Ver más (${count(Math.max(0, total - rows.length))})`}
        </button>
      ) : null}
    </>
  );
}
