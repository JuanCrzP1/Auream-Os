import "./broadcast-detail.css";
import "../list/broadcast-row.css";
import { useState } from "react";
import { ConfirmDialog } from "@shared/ui/dialog/ConfirmDialog";
import { count, progress, STATUS, when, whatItSends } from "../broadcastFormat";
import { FollowUpCard } from "./FollowUpCard";
import { ResultsFunnel } from "./ResultsFunnel";
import { RecipientsTable } from "./RecipientsTable";
import { SendingProgress } from "./SendingProgress";
import { useBroadcastDetail } from "./useBroadcastDetail";
import { VariantsCard } from "./VariantsCard";

/** Una difusión por dentro: en vivo, del envío a la venta, sus versiones, el segundo envío y cada persona. */
export function BroadcastDetail({ id, onBack, onOpen }: { readonly id: string; readonly onBack: () => void; readonly onOpen?: (id: string) => void }) {
  const { data, status, act, actionError, version } = useBroadcastDetail(id);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  if (status === "loading") return <div className="ui-page bc-detail"><p className="ui-muted">Cargando…</p></div>;
  if (!data) {
    return (
      <div className="ui-page bc-detail">
        <button type="button" className="ui-link" onClick={onBack}>← Difusiones</button>
        <p className="ui-error" role="alert">{status === "missing" ? "Esa difusión no existe." : "No pudimos cargar la difusión."}</p>
      </div>
    );
  }

  const { broadcast, canManage } = data;
  const state = STATUS[broadcast.status];
  const run = (action: "pause" | "resume" | "cancel") => {
    setBusy(true);
    void act(action).finally(() => setBusy(false));
  };
  const canPause = broadcast.status === "sending" || broadcast.status === "scheduled";
  const canResume = broadcast.status === "paused" || broadcast.status === "auto_paused";
  const canCancel = !["done", "cancelled"].includes(broadcast.status);

  return (
    <div className="ui-page bc-detail">
      <header className="bc-detail__header">
        <div className="bc-detail__title">
          <button type="button" className="bc-detail__back" onClick={onBack} aria-label="Volver a Difusiones">←</button>
          <div>
            <div className="bc-detail__name">
              <h1 className="ui-page__title">{broadcast.name}</h1>
              <span className={`bc-badge bc-badge--${state.tone}`}>{state.label}{broadcast.status === "sending" ? ` · ${progress(broadcast.stats)} %` : ""}</span>
            </div>
            <p className="ui-page__subtitle">
              {whatItSends(broadcast)} · {count(broadcast.stats.total)} personas · por {broadcast.connections.map((c) => c.name).join(", ")}
              {broadcast.startedAt ? ` · empezó ${when(broadcast.startedAt)}` : broadcast.scheduledAt ? ` · sale ${when(broadcast.scheduledAt)}` : ""}
            </p>
          </div>
        </div>
        {canManage ? (
          <div className="bc-detail__actions">
            {canPause ? <button type="button" className="ui-btn" disabled={busy} onClick={() => run("pause")}>❚❚ Pausar</button> : null}
            {canResume ? <button type="button" className="ui-btn ui-btn--primary" disabled={busy} onClick={() => run("resume")}>▶ Seguir</button> : null}
            {canCancel ? <button type="button" className="ui-btn ui-btn--danger" disabled={busy} onClick={() => setConfirmCancel(true)}>Cancelar lo que falta</button> : null}
          </div>
        ) : null}
      </header>

      {broadcast.statusReason ? <p className={`bc-detail__reason bc-detail__reason--${state.tone}`} role="status">{broadcast.statusReason}</p> : null}
      {actionError ? <p className="ui-error" role="alert">{actionError}</p> : null}

      <SendingProgress broadcast={broadcast} numbers={data.numbers} nextSendAt={data.nextSendAt} />
      <ResultsFunnel stats={broadcast.stats} />
      {broadcast.variants.length > 1 ? <VariantsCard broadcast={broadcast} results={data.variants} /> : null}
      {broadcast.followUp || broadcast.parentId ? <FollowUpCard broadcast={broadcast} onOpen={onOpen} /> : null}
      <RecipientsTable broadcastId={broadcast.id} refreshKey={version} />

      {confirmCancel ? (
        <ConfirmDialog
          title="¿Cancelar lo que falta?"
          message={`A los ${count(broadcast.stats.pending)} que faltan no les llegará. Lo ya enviado queda, con sus resultados.`}
          confirmLabel="Cancelar envío"
          onConfirm={() => act("cancel")}
          onClose={() => setConfirmCancel(false)}
        />
      ) : null}
    </div>
  );
}
