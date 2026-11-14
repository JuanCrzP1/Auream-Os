import "./schedules.css";
import { useState } from "react";
import { businessValueText, type BusinessDatumSummary } from "@contracts/BusinessDataContracts";
import { BUSINESS_SCHEDULE_LIMITS, type SaveBusinessScheduleRequest } from "@contracts/BusinessDataTimeline";
import { ScheduleCard } from "./ScheduleCard";
import { ScheduleForm } from "./ScheduleForm";

export interface ScheduleActions {
  readonly add: (request: SaveBusinessScheduleRequest) => Promise<unknown>;
  readonly change: (scheduleId: string, request: Partial<SaveBusinessScheduleRequest>) => Promise<unknown>;
  readonly remove: (scheduleId: string) => Promise<unknown>;
}

/**
 * La pestaña «Cambios programados»: otro valor entre dos fechas que entra y
 * sale solo. Los que vienen y el que rige ahora, cada uno con sus acciones,
 * y «Programar un cambio» (dueños y administradores).
 */
export function SchedulesTab({
  datum,
  all,
  timeZone,
  now,
  canManage,
  actions
}: {
  readonly datum: BusinessDatumSummary;
  readonly all: ReadonlyArray<BusinessDatumSummary>;
  readonly timeZone: string;
  readonly now: Date;
  readonly canManage: boolean;
  readonly actions: ScheduleActions;
}) {
  // «new»: programando uno; un id: editando ese.
  const [editing, setEditing] = useState<string | null>(null);
  const usual = businessValueText(datum);
  const full = datum.schedules.length >= BUSINESS_SCHEDULE_LIMITS.maxOpen;
  const form = (scheduleId?: string) => (
    <ScheduleForm
      key={scheduleId ?? "new"}
      datum={datum}
      all={all}
      timeZone={timeZone}
      now={now}
      {...(scheduleId ? { schedule: datum.schedules.find((schedule) => schedule.id === scheduleId)! } : {})}
      onSubmit={async (request) => {
        await (scheduleId ? actions.change(scheduleId, request) : actions.add(request));
        setEditing(null);
      }}
      onCancel={() => setEditing(null)}
    />
  );

  return (
    <div className="bd-drawer__body">
      <p className="bd-schedules__lead">
        Otro valor entre dos fechas. Mientras dura, sale en tus flujos, difusiones, respuestas rápidas y el MCP. Al terminar vuelve solo a <b>«{usual}»</b>.
      </p>

      {datum.schedules.length === 0 && editing !== "new" ? (
        <div className="bd-schedules__empty">
          <span className="bd-schedules__empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18M12 14v4M10 16h4" /></svg>
          </span>
          <strong>Ningún cambio programado</strong>
          <span>¿Cierras en Navidad o cambias algo por una promo? Programa el valor de esas fechas: entra solo y vuelve solo.</span>
        </div>
      ) : null}

      {datum.schedules.map((schedule) =>
        editing === schedule.id ? (
          form(schedule.id)
        ) : (
          <ScheduleCard
            key={schedule.id}
            schedule={schedule}
            type={datum.type}
            usualValue={datum.value}
            uses={datum.uses}
            timeZone={timeZone}
            now={now}
            canManage={canManage}
            onEdit={() => setEditing(schedule.id)}
            onRemove={() => actions.remove(schedule.id)}
          />
        )
      )}

      {canManage ? (
        editing === "new" ? (
          form()
        ) : full ? (
          <p className="bd-schedules__full">Ya hay {BUSINESS_SCHEDULE_LIMITS.maxOpen} cambios programados: quita alguno para programar otro.</p>
        ) : (
          <button type="button" className="bd-schedules__add" onClick={() => setEditing("new")}>
            + Programar un cambio
          </button>
        )
      ) : null}
    </div>
  );
}
