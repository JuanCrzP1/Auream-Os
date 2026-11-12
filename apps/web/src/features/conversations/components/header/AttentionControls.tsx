import { useRef, useState } from "react";
import type { ChatAgent, ConversationSummary } from "@contracts/ConversationContracts";
import { FloatingMenu } from "../FloatingMenu";

const ICONS = {
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  bot: (
    <>
      <rect x="4.5" y="8" width="15" height="11" rx="3.5" />
      <path d="M12 4.5V8M9.5 13h0M14.5 13h0" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5c1.2-3.3 3.9-5 7-5s5.8 1.7 7 5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  )
} as const;

const Icon = ({ name }: { readonly name: keyof typeof ICONS }) => <svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>;

/**
 * La atención del chat en la cabecera: su estado (con bot, en espera, quién lo
 * atiende, resuelto) abre el menú para pasarlo a alguien, dejarlo sin
 * asignar, devolverlo al bot o resolverlo; al lado, la acción del momento:
 * «Tomar chat» o «Resolver».
 */
export function AttentionControls({
  conversation,
  agents,
  meId,
  onTake,
  onAssign,
  onResolve,
  onToggleBot
}: {
  readonly conversation: ConversationSummary;
  readonly agents: ReadonlyArray<ChatAgent>;
  readonly meId: string | null;
  readonly onTake: () => void;
  readonly onAssign: (assigneeId: string | null) => void;
  readonly onResolve: () => void;
  readonly onToggleBot: () => void;
}) {
  const [open, setOpen] = useState(false);
  const pill = useRef<HTMLButtonElement>(null);
  const mine = Boolean(meId) && conversation.assigneeId === meId;
  const who = mine ? "Tú" : (conversation.assigneeName ?? "Un asesor");
  const state =
    conversation.status === "bot" ? { icon: "bot" as const, text: "Con bot" }
    : conversation.status === "waiting" ? { icon: "clock" as const, text: "En espera" }
    : conversation.status === "attending" ? { icon: "person" as const, text: who }
    : { icon: "check" as const, text: "Resuelto" };
  const act = (run: () => void) => {
    run();
    setOpen(false);
  };

  return (
    <div className="attention">
      <button
        ref={pill}
        type="button"
        className={`attention__state attention__state--${conversation.status}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Atención: ${state.text}. Cambiar`}
        title="Quién atiende este chat"
        onClick={() => setOpen(!open)}
      >
        <Icon name={state.icon} />
        <span className="attention__text">{state.text}</span>
        <svg className="attention__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
      </button>
      {conversation.status === "attending" ? (
        <button type="button" className="attention__action attention__action--resolve" onClick={onResolve} title="Resolver: el bot vuelve a atender; si el cliente escribe, se reabre">
          <Icon name="check" />
          <span>Resolver</span>
        </button>
      ) : (
        <button type="button" className="attention__action" onClick={onTake} title="Tomar chat: queda a tu nombre y el bot se pausa">
          <Icon name="person" />
          <span>Tomar chat</span>
        </button>
      )}

      {open ? (
        <FloatingMenu anchor={pill} label="Atención del chat" width={248} onClose={() => setOpen(false)}>
          <span className="floating-menu__label">Pasar a</span>
          {agents.map((agent) => (
            <button key={agent.userId} type="button" role="menuitem" className="floating-menu__item" onClick={() => act(() => onAssign(agent.userId))}>
              <Icon name="person" />
              {agent.userId === meId ? `${agent.name} (tú)` : agent.name}
              {agent.userId === conversation.assigneeId ? <span className="floating-menu__check" aria-label="Responsable actual">✓</span> : null}
            </button>
          ))}
          {conversation.assigneeId ? (
            <button type="button" role="menuitem" className="floating-menu__item" onClick={() => act(() => onAssign(null))}>
              <Icon name="clock" />
              Dejar sin asignar (en espera)
            </button>
          ) : null}
          <span className="floating-menu__divider" role="separator" />
          <button type="button" role="menuitem" className="floating-menu__item" onClick={() => act(onToggleBot)}>
            <Icon name="bot" />
            {conversation.botEnabled ? "Pausar el bot" : "Devolver al bot"}
          </button>
          {conversation.status !== "resolved" ? (
            <button type="button" role="menuitem" className="floating-menu__item" onClick={() => act(onResolve)}>
              <Icon name="check" />
              Resolver chat
            </button>
          ) : null}
        </FloatingMenu>
      ) : null}
    </div>
  );
}
