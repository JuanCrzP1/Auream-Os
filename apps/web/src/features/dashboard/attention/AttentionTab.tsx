import "./attention-tab.css";
import type { AttentionDashboardResponse } from "@contracts/AttentionContracts";
import type { DashboardFilters } from "@contracts/DashboardContracts";
import { timeAgo } from "@shared/format/timeAgo";
import { trendText } from "../dashboardFormat";
import { dashboardApi } from "../services/dashboardApi";
import { useDashboardData } from "../useDashboardData";
import { AgentsTable } from "./AgentsTable";
import { Heatmap } from "./Heatmap";

const minutes = (value: number | null) => (value === null ? "—" : value < 1 ? "menos de 1 min" : value < 60 ? `${Math.round(value)} min` : `${Math.round(value / 6) / 10} h`);

/**
 * Dashboard › Atención: chats nuevos, cuántos atiende un asesor y cuántos solo
 * el bot, en cuánto responden, quién espera ahora, cuándo escriben y cómo le
 * va a cada asesor y a cada número.
 */
export function AttentionTab({ filters }: { readonly filters: DashboardFilters }) {
  const { data, failed } = useDashboardData<AttentionDashboardResponse>(() => dashboardApi.attention(filters), JSON.stringify(filters));
  if (failed) return <p className="ui-error" role="alert">No pudimos cargar la atención. Vuelve a intentarlo en unos segundos.</p>;
  if (!data) return <div className="attention-tab__loading" aria-busy="true" aria-label="Cargando la atención" />;
  const botShare = data.leads.value > 0 ? Math.round((data.botOnly / data.leads.value) * 100) : null;
  const responseTrend = data.firstResponseMinutes !== null && data.previousFirstResponseMinutes ? trendText({ change: (data.firstResponseMinutes - data.previousFirstResponseMinutes) / data.previousFirstResponseMinutes }, "down") : null;
  const cards = [
    { label: "Chats nuevos", value: data.leads.value.toLocaleString("es-CO"), note: trendText(data.leads)?.text ?? "en el periodo", tone: "lead" },
    { label: "Atendidos por un asesor", value: data.attendedByAgents.value.toLocaleString("es-CO"), note: trendText(data.attendedByAgents)?.text ?? "con al menos una respuesta", tone: "" },
    { label: "Responden en", value: minutes(data.firstResponseMinutes), note: responseTrend ? `${responseTrend.text} · la mitad de las veces` : "la mitad de las veces", tone: "" },
    { label: "Solo el bot", value: botShare === null ? "—" : `${botShare} %`, note: `${data.botOnly.toLocaleString("es-CO")} chats sin asesor`, tone: "" },
    { label: "Sin responder ahora", value: data.unanswered.toLocaleString("es-CO"), note: data.oldestWaitingAt ? `el más antiguo, ${timeAgo(data.oldestWaitingAt)}` : "nadie esperando", tone: data.unanswered > 0 ? "warn" : "" }
  ];
  return (
    <div className="attention-tab">
      <section className="attention-tab__cards" aria-label="Atención en números">
        {cards.map((card) => (
          <div key={card.label} className={`attention-tab__card${card.tone ? ` attention-tab__card--${card.tone}` : ""}`}>
            <span className="attention-tab__label">{card.label}</span>
            <strong>{card.value}</strong>
            <span className="ui-muted">{card.note}</span>
          </div>
        ))}
      </section>
      {data.unanswered > 0 ? <a className="attention-tab__waiting" href="/conversations">Responder a los {data.unanswered} que esperan →</a> : null}
      <Heatmap grid={data.heatmap} peak={data.peak} />
      <AgentsTable agents={data.agents} currency={data.currency} />
      <section className="attention-tab__connections" aria-labelledby="attention-numbers-title">
        <h2 id="attention-numbers-title">Por número</h2>
        {data.connections.length === 0 ? <p className="ui-muted">Aún no tienes números conectados.</p> : null}
        <ul>
          {data.connections.map((connection) => (
            <li key={connection.id}>
              <span className={`attention-tab__dot${connection.connected ? " attention-tab__dot--on" : ""}`} aria-hidden="true" />
              <strong>{connection.name}</strong>
              <span className="ui-muted">{connection.leads} chats · {connection.attended} con asesor · {connection.unanswered} sin responder</span>
              <span className={`attention-tab__state${connection.connected ? "" : " attention-tab__state--off"}`}>{connection.connected ? "Conectado" : "Desconectado"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
