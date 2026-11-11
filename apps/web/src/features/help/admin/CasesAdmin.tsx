import { useCallback, useEffect, useState } from "react";
import type { SupportCase } from "@contracts/HelpContracts";
import { helpApi } from "@shared/help/helpApi";
import { timeAgo } from "@shared/format/timeAgo";

/** Los casos de todas las cuentas: los abiertos primero; responder o cerrar. */
export function CasesAdmin() {
  const [status, setStatus] = useState<string | null>("open");
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const load = useCallback(() => void helpApi.allCases(status).then(setCases).catch(() => setCases([])), [status]);
  useEffect(load, [load]);
  const answer = async (id: string, next: SupportCase["status"]) => {
    await helpApi.replyCase(id, replies[id] ?? "", next).catch(() => undefined);
    load();
  };
  return (
    <section className="help-admin__cases" aria-label="Casos de soporte">
      <div className="help-admin__filters">
        {[["open", "Abiertos"], ["answered", "Respondidos"], ["closed", "Cerrados"], [null, "Todos"]].map(([value, label]) => (
          <button key={label} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>
        ))}
      </div>
      {cases.length === 0 ? <p className="ui-muted">No hay casos aquí.</p> : null}
      {cases.map((item) => (
        <article key={item.id} className="help-admin__case">
          <header><strong>{item.account?.tenantName ?? "Cuenta"} · {item.topic}</strong><small>{item.account?.userEmail ?? ""} · {timeAgo(item.createdAt)} · desde {item.page}</small></header>
          <p>{item.message}</p>
          {item.screenshotUrl ? <a href={item.screenshotUrl} target="_blank" rel="noreferrer">Ver la captura</a> : null}
          {item.reply ? <p className="help-admin__reply"><strong>Respuesta:</strong> {item.reply}</p> : null}
          {item.status !== "closed" ? (
            <div className="help-admin__answer">
              <textarea className="ui-input" rows={2} placeholder="Escribe la respuesta (la verá en Ayuda)." value={replies[item.id] ?? ""} onChange={(e) => setReplies({ ...replies, [item.id]: e.target.value })} />
              <span><button type="button" className="ui-btn ui-btn--primary" disabled={!(replies[item.id] ?? "").trim()} onClick={() => void answer(item.id, "answered")}>Responder</button><button type="button" className="ui-btn" onClick={() => void answer(item.id, "closed")}>Cerrar</button></span>
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}
