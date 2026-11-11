import "./sending-progress.css";
import type { BroadcastSummary, NumberPace } from "@contracts/BroadcastResultsContracts";
import { count, progress, when } from "../broadcastFormat";

function nextText(broadcast: BroadcastSummary, nextSendAt: string | null): string {
  if (broadcast.status === "scheduled") return `Sale ${when(broadcast.scheduledAt ?? nextSendAt)}`;
  if (broadcast.status === "testing") return `Probando versiones · decide ${when(broadcast.abTest?.decidesAt ?? null)}`;
  if (broadcast.status === "paused") return "Pausada: nadie más recibe hasta que le des «Seguir».";
  if (broadcast.status !== "sending") return broadcast.stats.pending > 0 ? `${count(broadcast.stats.pending)} quedaron sin enviar` : "Envío terminado";
  if (!nextSendAt) return "Enviando…";
  const seconds = Math.round((new Date(nextSendAt).getTime() - Date.now()) / 1000);
  if (seconds <= 60) return `Siguiente en ${Math.max(1, seconds)} s`;
  return `Sigue ${when(nextSendAt)} (horario o tope del día)`;
}

/** Cuánto va, cuándo sale el siguiente y cómo va cada número hoy. */
export function SendingProgress({ broadcast, numbers, nextSendAt }: { readonly broadcast: BroadcastSummary; readonly numbers: ReadonlyArray<NumberPace>; readonly nextSendAt: string | null }) {
  const { stats } = broadcast;
  const done = stats.total - stats.pending;
  const live = ["sending", "scheduled", "paused", "auto_paused", "testing"].includes(broadcast.status);
  const failRate = stats.sent + stats.failed > 0 ? stats.failed / (stats.sent + stats.failed) : 0;
  return (
    <section className="bc-progress" aria-label="Avance">
      <div className="bc-progress__main">
        <div className="bc-progress__line">
          <strong>{count(done)} de {count(stats.total)} enviados</strong>
          <span>{nextText(broadcast, nextSendAt)}</span>
        </div>
        <div className="bc-progress__bar" role="progressbar" aria-valuenow={progress(stats)} aria-valuemin={0} aria-valuemax={100}>
          <span className={`bc-progress__fill${broadcast.status === "paused" || broadcast.status === "auto_paused" ? " bc-progress__fill--paused" : ""}`} style={{ width: `${progress(stats)}%` }} />
        </div>
      </div>
      <div className="bc-progress__numbers">
        {(live ? numbers : []).map((number) => (
          <span key={number.connectionId} className="bc-progress__number">
            <strong>{number.sentToday} / {number.capToday}</strong>
            hoy por {number.name}
            {number.warmupDay ? ` · calentando día ${number.warmupDay}` : ""}
            {!number.connected ? " · desconectado" : ""}
          </span>
        ))}
        <span className="bc-progress__number">
          <strong className={failRate > 0.05 ? "bc-progress__bad" : "bc-progress__good"}>{(failRate * 100).toFixed(1).replace(".", ",")} %</strong>
          fallos (se pausa en 5 %)
        </span>
      </div>
    </section>
  );
}
