import "./detail-cards.css";
import type { BroadcastSummary, VariantResult } from "@contracts/BroadcastResultsContracts";
import { contentLabel, count, money, percent, readable, VARIANT_LETTERS, when } from "../broadcastFormat";

/** Cada versión con lo que logró; con prueba A/B, cuál ganó (o cuándo se decide). */
export function VariantsCard({ broadcast, results }: { readonly broadcast: BroadcastSummary; readonly results: ReadonlyArray<VariantResult> }) {
  const ab = broadcast.abTest;
  return (
    <section className="bc-card" aria-label="Versiones">
      <div className="bc-card__head">
        <strong>{ab ? "Prueba A/B por ventas" : "Versiones (cada persona recibió una al azar)"}</strong>
        <span className="ui-muted">
          {ab ? (ab.winner !== null ? `Ganó la ${VARIANT_LETTERS[ab.winner]}: al resto le llegó esa.` : ab.decidesAt ? `Decide ${when(ab.decidesAt)}` : `Prueban ${ab.sharePercent} % de la lista`) : ""}
        </span>
      </div>
      <div className="bc-variants">
        {broadcast.variants.map((variant, index) => {
          const result = results.find((r) => r.variant === index);
          const won = ab?.winner === index;
          return (
            <div key={index} className={`bc-variants__item${won ? " bc-variants__item--won" : ""}`}>
              <span className="bc-variants__letter">Versión {VARIANT_LETTERS[index]}{won ? " · ganadora" : ""}</span>
              <span className="bc-variants__what">
                {variant.content.kind === "message" && variant.content.text ? `«${readable(variant.content.text).slice(0, 80)}${variant.content.text.length > 80 ? "…" : ""}»` : contentLabel(variant.content, variant.flowName)}
              </span>
              <dl>
                <div><dt>Enviados</dt><dd>{count(result?.sent ?? 0)}</dd></div>
                <div><dt>Respondieron</dt><dd>{percent(result?.replied ?? 0, result?.sent ?? 0)}</dd></div>
                <div><dt>Compraron</dt><dd>{count(result?.bought ?? 0)}</dd></div>
                <div><dt>Vendido</dt><dd>{money(result?.revenue ?? []).main}</dd></div>
              </dl>
            </div>
          );
        })}
      </div>
    </section>
  );
}
