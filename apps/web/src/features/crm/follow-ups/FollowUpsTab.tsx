import "./follow-ups.css";
import "./follow-ups-tab.css";
import { useState } from "react";
import type { FollowUpBucket } from "@contracts/CrmActivityContracts";
import { FollowUpItem } from "./FollowUpItem";
import { useFollowUps } from "./useFollowUps";

const EMPTY: Readonly<Record<FollowUpBucket, string>> = {
  overdue: "Nada vencido. ¡Vas al día!",
  today: "Nada para hoy. Agrega seguimientos desde la ficha de cada cliente.",
  upcoming: "Nada programado para los próximos días.",
  done: "Aún no hay seguimientos hechos."
};

/** Los seguimientos del equipo: los de quien mira (o de todos), por cuándo tocan. */
export function FollowUpsTab({ canWrite, refreshKey, onOpenContact, onChanged }: {
  readonly canWrite: boolean;
  readonly refreshKey: number;
  readonly onOpenContact: (contactId: string) => void;
  /** Se marcó o desmarcó uno: la página actualiza su número de vencidos. */
  readonly onChanged?: () => void;
}) {
  const [bucket, setBucket] = useState<FollowUpBucket>("today");
  const [assignee, setAssignee] = useState<"me" | "all">("me");
  const list = useFollowUps(bucket, assignee, refreshKey);
  const counts = list.data?.counts;
  const tabs: ReadonlyArray<readonly [FollowUpBucket, string, number | undefined]> = [
    ["overdue", "Vencidos", counts?.overdue],
    ["today", "Hoy", counts?.today],
    ["upcoming", "Próximos", counts?.upcoming],
    ["done", "Hechos", undefined]
  ];

  return (
    <section className="follow-ups-tab" aria-label="Seguimientos">
      <div className="follow-ups-tab__bar">
        <div className="follow-ups-tab__group" role="group" aria-label="Cuándo">
          {tabs.map(([id, label, count]) => (
            <button key={id} type="button" aria-pressed={bucket === id} className={`follow-ups-tab__toggle${id === "overdue" && (count ?? 0) > 0 ? " follow-ups-tab__toggle--alert" : ""}`} onClick={() => setBucket(id)}>
              {label}
              {count !== undefined ? <span className="follow-ups-tab__count">{count}</span> : null}
            </button>
          ))}
        </div>
        <div className="follow-ups-tab__group follow-ups-tab__group--outline" role="group" aria-label="De quién">
          <button type="button" aria-pressed={assignee === "me"} className="follow-ups-tab__toggle" onClick={() => setAssignee("me")}>Míos</button>
          <button type="button" aria-pressed={assignee === "all"} className="follow-ups-tab__toggle" onClick={() => setAssignee("all")}>De todo el equipo</button>
        </div>
      </div>
      {list.status === "error" ? (
        <p className="ui-error" role="alert">No pudimos cargar los seguimientos. Vuelve a intentarlo en unos segundos.</p>
      ) : list.status === "loading" && !list.data ? (
        <p className="ui-muted" aria-busy="true">Cargando…</p>
      ) : list.data && list.data.followUps.length === 0 ? (
        <p className="follow-ups-tab__empty">{EMPTY[bucket]}</p>
      ) : (
        <ul className="follow-up-list">
          {list.data?.followUps.map((followUp) => (
            <FollowUpItem
              key={followUp.id}
              followUp={followUp}
              canWrite={canWrite}
              showContact
              onOpenContact={onOpenContact}
              onToggle={(item) => void list.toggle(item).then(() => onChanged?.())}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
