import "./reach-card.css";
import type { AudiencePreview } from "@contracts/BroadcastResultsContracts";
import { count } from "../broadcastFormat";

/** A cuántos les llega, en vivo. */
export function ReachCard({ preview, loading, hasNumbers }: { readonly preview: AudiencePreview | null; readonly loading: boolean; readonly hasNumbers: boolean }) {
  const excluded = [
    preview?.optedOut ? `${count(preview.optedOut)} pidieron no recibir más` : null,
    preview?.overLimit ? `${count(preview.overLimit)} quedan fuera (máximo 5.000 por difusión)` : null
  ].filter(Boolean);
  return (
    <section className="bc-reach" aria-label="A cuántos les llega" aria-busy={loading}>
      <span className="bc-reach__label">Le llega a</span>
      <strong className="bc-reach__count">{!hasNumbers ? "—" : preview ? count(preview.count) : "…"}</strong>
      <span className="bc-reach__hint">
        {!hasNumbers ? "Elige un número para contar." : preview?.count === 1 ? "persona que ya te escribió" : "personas que ya te escribieron"}
      </span>
      {excluded.length > 0 ? <span className="bc-reach__hint">{excluded.join(" · ")}</span> : null}
    </section>
  );
}
