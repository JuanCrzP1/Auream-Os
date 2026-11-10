import "./agents-table.css";
import type { AgentPerformance } from "@contracts/AttentionContracts";
import { initialsFromName } from "./initials";
import { money } from "../dashboardFormat";

const speedTone = (minutes: number | null) => (minutes === null ? "none" : minutes <= 5 ? "ok" : minutes <= 15 ? "warn" : "bad");

/** Cada asesor: lo que atiende, en cuánto responde y lo que vende. */
export function AgentsTable({ agents, currency }: { readonly agents: ReadonlyArray<AgentPerformance>; readonly currency: string }) {
  return (
    <section className="attention-agents" aria-labelledby="agents-title">
      <header>
        <h2 id="agents-title">Desempeño por asesor</h2>
        <span className="ui-muted">meta de respuesta: menos de 5 min</span>
      </header>
      {agents.length === 0 ? <p className="ui-muted attention-agents__empty">Ningún asesor respondió chats en este periodo.</p> : (
        <div className="attention-agents__scroll">
          <table>
            <thead>
              <tr><th scope="col">Asesor</th><th scope="col">Chats atendidos</th><th scope="col">Mensajes</th><th scope="col">Responde en</th><th scope="col">Ventas</th><th scope="col">Vendido</th></tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.userId}>
                  <th scope="row"><span className="attention-agents__who"><span className="attention-agents__avatar" aria-hidden="true">{initialsFromName(agent.name)}</span>{agent.name}</span></th>
                  <td>{agent.attended}</td>
                  <td>{agent.messages}</td>
                  <td><span className={`attention-agents__speed attention-agents__speed--${speedTone(agent.responseMinutes)}`}>{agent.responseMinutes === null ? "—" : `${Math.round(agent.responseMinutes)} min`}</span></td>
                  <td>{agent.sales}</td>
                  <td><strong>{money(agent.revenue, currency)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
