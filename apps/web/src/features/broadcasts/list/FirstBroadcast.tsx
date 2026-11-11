import { EmptyState } from "@shared/ui/empty-state/EmptyState";
import { BroadcastIllustration } from "./BroadcastIllustration";

const ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);

/** Difusiones sin ninguna: qué es y crear la primera. */
export function FirstBroadcast({ canManage, onNew }: { readonly canManage: boolean; readonly onNew: () => void }) {
  return (
    <EmptyState
      icon={ICON}
      label="Tu primera difusión"
      title="Envía tu primera difusión"
      description="Un flujo o un mensaje a los clientes que ya te escribieron, con un ritmo que cuida tu número, y lo que vendió cada envío."
      actions={canManage ? <button type="button" className="ui-btn ui-btn--primary" onClick={onNew}>Crear difusión</button> : <span className="ui-muted">Las difusiones las crean los dueños y administradores.</span>}
      visual={<BroadcastIllustration />}
      steps={["Elige a quién", "Se envía con ritmo seguro", "Ves quién leyó, respondió y compró"]}
    />
  );
}
