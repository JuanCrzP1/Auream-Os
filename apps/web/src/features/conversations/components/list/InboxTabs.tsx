import type { ConversationStatus } from "@contracts/ConversationContracts";
import { TAB_OPTIONS, type InboxTab } from "../../model/inboxFilters";

/**
 * Las pestañas de la bandeja por atención: Todos · En espera · En atención ·
 * Con bot · Resueltos, con cuántos chats hay en cada una. «En espera» resalta
 * su número: es lo que nadie ha tomado.
 */
export function InboxTabs({
  value,
  counts,
  onChange
}: {
  readonly value: InboxTab;
  readonly counts: Readonly<Record<ConversationStatus, number>> | null;
  readonly onChange: (tab: InboxTab) => void;
}) {
  return (
    <div className="inbox-tabs" role="tablist" aria-label="Atención de los chats">
      {TAB_OPTIONS.map((option) => {
        const count = option.value === "all" ? null : (counts?.[option.value] ?? null);
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={value === option.value}
            aria-label={count ? `${option.label}, ${count}` : option.label}
            className={`inbox-tabs__tab${value === option.value ? " is-active" : ""}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
            {count ? <span className={`inbox-tabs__count${option.value === "waiting" ? " is-alert" : ""}`}>{count > 99 ? "99+" : count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
