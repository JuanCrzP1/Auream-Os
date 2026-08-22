import "./panel-shell.css";
import "./simulation-panel.css";
import "../toolbar-button.css";
import { useState } from "react";

interface SimulationPanelProps {
  status: "idle" | "running" | "error";
  messages: Array<{
    id: string;
    role: "user" | "bot";
    content: string;
  }>;
  onSend: (message: string) => Promise<void>;
}

export function SimulationPanel({ status, messages, onSend }: SimulationPanelProps) {
  const [draft, setDraft] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.trim()) {
      return;
    }

    const nextMessage = draft;
    setDraft("");
    await onSend(nextMessage);
  }

  return (
    <section className="sidebar-panel">
      <div className="sidebar-panel__header">
        <p>Simulador</p>
        <span>{status === "running" ? "procesando" : "sandbox"}</span>
      </div>
      <div className="simulation-log">
        {messages.length === 0 ? <p className="empty-copy">Envía un mensaje para probar el draft sin salir del builder.</p> : null}
        {messages.map((message) => (
          <article key={message.id} className={message.role === "user" ? "simulation-bubble simulation-bubble--user" : "simulation-bubble simulation-bubble--bot"}>
            <span>{message.role === "user" ? "Usuario" : "Bot"}</span>
            <p>{message.content}</p>
          </article>
        ))}
      </div>
      <form className="simulation-form" onSubmit={(event) => void handleSubmit(event)}>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escribe una entrada para simular" />
        <button type="submit" className="toolbar-button toolbar-button--primary">Enviar</button>
      </form>
    </section>
  );
}