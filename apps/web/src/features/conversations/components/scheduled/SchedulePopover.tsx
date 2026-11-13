import "./scheduled.css";
import { useEffect, useRef, useState } from "react";
import type { ScheduleMessageRequest } from "@contracts/ScheduledMessageContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { presets, whenProblem, zoneLabel } from "./scheduleModel";
import { WhenPicker, type ScheduleChoice } from "./WhenPicker";

/** Programar lo escrito en el compositor: la zona del negocio y quién lo guarda. */
export interface ComposerSchedule {
  readonly timeZone: string;
  readonly onSchedule: (request: ScheduleMessageRequest) => Promise<void>;
}

/** ⏰ junto a enviar (solo con algo escrito): abre «Programar envío». */
export function ScheduleToggle({ open, disabled, onToggle }: { readonly open: boolean; readonly disabled: boolean; readonly onToggle: () => void }) {
  return (
    <button type="button" className={`chat-tool${open ? " is-active" : ""}`} aria-label="Programar envío" title="Programar envío" aria-expanded={open} disabled={disabled} data-schedule-toggle onClick={onToggle}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6M19 5l1.5 1.5" /></svg>
    </button>
  );
}

/**
 * «Programar envío» sobre el compositor: lo escrito (texto, archivos,
 * respuesta rápida) sale solo a la hora elegida. Empieza en «Mañana
 * temprano». Se cierra con Escape o al tocar fuera.
 */
export function SchedulePopover({
  timeZone,
  onSchedule,
  onClose
}: {
  readonly timeZone: string;
  readonly onSchedule: (choice: ScheduleChoice) => Promise<void>;
  readonly onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [now] = useState(() => new Date());
  const [choice, setChoice] = useState<ScheduleChoice>(() => ({ when: presets(now, timeZone)[1]!.when, cancelIfReplied: true }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!box.current?.contains(target) && !target.closest("[data-schedule-toggle]")) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [onClose]);

  const submit = async () => {
    const problem = whenProblem(choice.when, timeZone, new Date());
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await onSchedule(choice);
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo programar el mensaje."));
      setBusy(false);
    }
  };

  return (
    <div className="chat-popover schedule-popover" ref={box} role="dialog" aria-label="Programar envío">
      <header className="schedule-popover__header">
        <h3 className="chat-popover__title">Programar envío</h3>
        <span className="schedule-popover__zone">{zoneLabel(timeZone)}</span>
      </header>
      <WhenPicker timeZone={timeZone} now={now} value={choice} onChange={setChoice} />
      {error ? <p className="ui-error" role="alert">{error}</p> : null}
      <footer className="schedule-popover__footer">
        <button type="button" className="ui-btn ui-btn--primary" disabled={busy} onClick={() => void submit()}>
          {busy ? "Programando…" : "Programar"}
        </button>
      </footer>
    </div>
  );
}
