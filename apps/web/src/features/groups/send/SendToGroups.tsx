import "./send-to-groups.css";
import "./send-preview.css";
import { useEffect, useMemo, useState } from "react";
import type { CampaignSummary, GroupSummary } from "@contracts/GroupContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { count } from "../groupsFormat";
import { groupsApi } from "../services/groupsApi";
import { PostContent } from "./PostContent";
import { emptyPost, postProblem, toRequest, type PostDraft } from "./postDraft";

/** Un mensaje a muchos grupos: elegir campañas o grupos sueltos, qué enviar, avisar a todos y cuándo. */
export function SendToGroups({ preset, onClose, onSent }: { readonly preset: string | null; readonly onClose: () => void; readonly onSent: () => void }) {
  const [campaigns, setCampaigns] = useState<ReadonlyArray<CampaignSummary>>([]);
  const [groups, setGroups] = useState<ReadonlyArray<GroupSummary>>([]);
  const [draft, setDraft] = useState<PostDraft>(() => emptyPost(preset));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (patch: Partial<PostDraft>) => setDraft((current) => ({ ...current, ...patch }));

  useEffect(() => {
    void groupsApi.overview().then((data) => setCampaigns(data.campaigns)).catch(() => undefined);
    void groupsApi.list().then((data) => setGroups(data.groups.filter((g) => g.isAdmin))).catch(() => undefined);
  }, []);

  const chosen = useMemo(() => groups.filter((g) => draft.groupIds.includes(g.id) || (g.campaignId !== null && draft.campaignIds.includes(g.campaignId))), [groups, draft]);
  const people = chosen.reduce((total, g) => total + g.members, 0);
  const toggle = (key: "campaignIds" | "groupIds", id: string) => update({ [key]: draft[key].includes(id) ? draft[key].filter((x) => x !== id) : [...draft[key], id] } as Partial<PostDraft>);
  const problem = postProblem(draft, chosen.length);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await groupsApi.send(toRequest(draft));
      onSent();
    } catch (failure) {
      setError(apiErrorMessage(failure, "No se pudo enviar."));
      setBusy(false);
    }
  };

  return (
    <div className="ui-page gr-send">
      <header className="gr-send__header">
        <button type="button" className="gr-send__back" onClick={onClose} aria-label="Volver">←</button>
        <div>
          <h1 className="ui-page__title">Enviar a grupos</h1>
          <p className="ui-page__subtitle">Sale grupo por grupo, con 10 a 30 s al azar entre uno y otro, por el número que administra cada grupo.</p>
        </div>
      </header>
      <div className="gr-send__body">
        <section className="gr-send__card" aria-label="El envío">
          <div className="gr-send__block">
            <span className="gr-send__label">A qué grupos</span>
            <div className="gr-send__chips">
              {campaigns.map((campaign) => (
                <button key={campaign.id} type="button" className={`gr-send__chip${draft.campaignIds.includes(campaign.id) ? " gr-send__chip--on" : ""}`} aria-pressed={draft.campaignIds.includes(campaign.id)} onClick={() => toggle("campaignIds", campaign.id)}>
                  Campaña {campaign.name} · {campaign.groups.length}
                </button>
              ))}
            </div>
            {groups.filter((g) => !g.campaignId).length > 0 ? (
              <details className="gr-send__more">
                <summary>Grupos sin campaña</summary>
                <div className="gr-send__chips">
                  {groups.filter((g) => !g.campaignId).map((group) => (
                    <button key={group.id} type="button" className={`gr-send__chip${draft.groupIds.includes(group.id) ? " gr-send__chip--on" : ""}`} aria-pressed={draft.groupIds.includes(group.id)} onClick={() => toggle("groupIds", group.id)}>
                      {group.name} · {count(group.members)}
                    </button>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
          <PostContent draft={draft} update={update} />
          {error ? <p className="ui-error" role="alert">{error}</p> : null}
          <footer className="gr-send__footer">
            <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>Cancelar</button>
            <span className="gr-send__problem">{problem}</span>
            <button type="button" className="ui-btn ui-btn--primary" disabled={Boolean(problem) || busy} onClick={() => void send()}>
              {busy ? "Enviando…" : `${draft.scheduledAt ? "Programar para" : "Enviar a"} ${chosen.length} ${chosen.length === 1 ? "grupo" : "grupos"}`}
            </button>
          </footer>
        </section>
        <aside className="gr-send__aside">
          <div className="gr-send__reach" aria-label="A cuántos les llega">
            <span>Le llega a</span>
            <strong>{count(people)}</strong>
            <small>personas en {chosen.length} {chosen.length === 1 ? "grupo" : "grupos"}</small>
          </div>
          <div className="gr-send__phone">
            <span className="gr-send__phone-top">{chosen[0]?.name ?? "Tu grupo"}</span>
            <span className="gr-send__bubble">
              {draft.media && draft.kind === "image" ? <img src={draft.media.url} alt="" /> : null}
              {draft.kind === "video" && draft.media ? <span className="gr-send__file">🎬 {draft.media.fileName}</span> : null}
              {draft.kind === "audio" && draft.media ? <span className="gr-send__file">🎙 Nota de voz</span> : null}
              {draft.kind === "poll" ? <><strong>📊 {draft.text || "Tu pregunta"}</strong>{draft.choices.filter(Boolean).map((c) => <span key={c} className="gr-send__choice">○ {c}</span>)}</> : <span>{draft.text || "Tu mensaje"}</span>}
              <small>{draft.mentionAll ? "avisa a todos · " : ""}10:02 ✓✓</small>
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
