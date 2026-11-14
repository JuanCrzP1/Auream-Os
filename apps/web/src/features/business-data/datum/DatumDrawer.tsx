import "./datum-drawer.css";
import { useId, useState } from "react";
import { BUSINESS_DATA_TYPE_LABEL, type BusinessDatumSummary, type SaveBusinessDatumRequest } from "@contracts/BusinessDataContracts";
import { HistoryTab } from "../history/HistoryTab";
import { SchedulesTab, type ScheduleActions } from "../schedules/SchedulesTab";
import { DatumEditor } from "./DatumEditor";

export type DatumTab = "datum" | "schedules" | "history";

/**
 * El detalle de un dato, en tres pestañas: «Dato» (su valor, cómo lo ve tu
 * cliente y dónde se usa), «Cambios programados» (otro valor entre dos
 * fechas) e «Historial» (quién cambió qué y cuándo).
 */
export function DatumDrawer({
  datum,
  all,
  timeZone,
  now,
  canManage,
  initialTab = "datum",
  onSave,
  schedules,
  onDelete,
  onClose
}: {
  readonly datum: BusinessDatumSummary;
  /** Todos los datos de la cuenta: un mensaje puede usar varios. */
  readonly all: ReadonlyArray<BusinessDatumSummary>;
  readonly timeZone: string;
  readonly now: Date;
  readonly canManage: boolean;
  readonly initialTab?: DatumTab;
  readonly onSave: (changes: Partial<SaveBusinessDatumRequest>) => Promise<unknown>;
  readonly schedules: ScheduleActions;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const [tab, setTab] = useState<DatumTab>(initialTab);
  const [busy, setBusy] = useState(false);
  const tabs: ReadonlyArray<{ readonly id: DatumTab; readonly label: string; readonly count?: number }> = [
    { id: "datum", label: "Dato" },
    { id: "schedules", label: "Cambios programados", count: datum.schedules.length },
    { id: "history", label: "Historial" }
  ];

  return (
    <div className="bd-drawer-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <aside className="bd-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="bd-drawer__hero">
          <button type="button" className="bd-drawer__close" aria-label="Cerrar" onClick={onClose}>×</button>
          <span className="bd-drawer__eyebrow">Dato del negocio · {BUSINESS_DATA_TYPE_LABEL[datum.type]}</span>
          <h2 id={titleId}>{datum.label}</h2>
          <code className="bd-drawer__key">{`{${datum.key}}`}</code>
        </header>

        <nav className="bd-drawer__tabs" role="tablist" aria-label="Secciones del dato">
          {tabs.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "is-on" : undefined} onClick={() => setTab(item.id)}>
              {item.label}
              {item.count ? <span className="bd-drawer__count">{item.count}</span> : null}
            </button>
          ))}
        </nav>

        {tab === "datum" ? (
          <DatumEditor datum={datum} all={all} timeZone={timeZone} now={now} canManage={canManage} onSave={onSave} onDelete={onDelete} onBusy={setBusy} onDone={onClose} />
        ) : tab === "schedules" ? (
          <SchedulesTab datum={datum} all={all} timeZone={timeZone} now={now} canManage={canManage} actions={schedules} />
        ) : (
          <HistoryTab datum={datum} timeZone={timeZone} now={now} canManage={canManage} onRestore={(value) => onSave({ value })} />
        )}
      </aside>
    </div>
  );
}
