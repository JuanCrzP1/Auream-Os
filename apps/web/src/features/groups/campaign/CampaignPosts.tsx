import "./campaign-posts.css";
import type { GroupPostSummary } from "@contracts/GroupContracts";
import { POST_STATUS, postLabel, when } from "../groupsFormat";

/** Los envíos a los grupos de la campaña: lo programado y lo que ya salió. */
export function CampaignPosts({ posts, canManage, onSend, onCancel }: {
  readonly posts: ReadonlyArray<GroupPostSummary>;
  readonly canManage: boolean;
  readonly onSend: () => void;
  readonly onCancel: (id: string) => void;
}) {
  return (
    <section className="gr-panel" aria-label="Envíos">
      <div className="gr-panel__head">
        <h2>Envíos a los grupos</h2>
        {canManage ? <button type="button" className="ui-link" onClick={onSend}>+ Programar</button> : null}
      </div>
      {posts.length === 0 ? <p className="ui-muted">Aún no hay envíos. Programa el lanzamiento, la oferta o una encuesta.</p> : null}
      <ol className="gr-posts">
        {posts.map((post) => (
          <li key={post.id} className={`gr-posts__item gr-posts__item--${post.status}`}>
            <span className="gr-posts__dot" aria-hidden="true" />
            <span className="gr-posts__body">
              <strong>{post.status === "scheduled" ? `${POST_STATUS.scheduled} · ${when(post.scheduledAt ?? post.createdAt)}` : `${POST_STATUS[post.status]} · ${when(post.finishedAt ?? post.scheduledAt ?? post.createdAt)}`}</strong>
              <span>{postLabel(post.content)}</span>
              <small>
                {post.groups} {post.groups === 1 ? "grupo" : "grupos"}{post.sent ? ` · ${post.sent} enviados` : ""}{post.failed ? ` · ${post.failed} fallaron` : ""}{post.mentionAll ? " · avisa a todos" : ""}
              </small>
            </span>
            {canManage && (post.status === "scheduled" || post.status === "sending") ? (
              <button type="button" className="ui-link" onClick={() => onCancel(post.id)}>Cancelar</button>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
