import { AureamMark } from "@shared/brand/AureamMark";

/** El agente (su inicial) conectándose con Auream: la cabecera de la autorización. */
export function ConsentHandshake({ clientName }: { readonly clientName: string }) {
  return (
    <div className="oauth-consent__handshake" aria-hidden="true">
      <span className="oauth-consent__agent">{clientName.trim().charAt(0).toUpperCase() || "A"}</span>
      <span className="oauth-consent__handshake-line" />
      <AureamMark width={44} />
    </div>
  );
}
