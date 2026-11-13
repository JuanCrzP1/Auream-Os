import "./measurement-notice.css";
import { Link } from "react-router-dom";
import type { AdMeasurement } from "@contracts/AdMeasurementContracts";
import { measurementCopy } from "./measurementText";

/**
 * El aviso de que Auream no ve (o ve a medias) lo que venden los anuncios:
 * qué pasa y qué hacer. Midiendo todo, no aparece.
 */
export function MeasurementNotice({ measurement }: { readonly measurement: AdMeasurement }) {
  const copy = measurementCopy(measurement);
  if (!copy) return null;
  return (
    <section className="measurement-notice" role="status" aria-label={copy.title}>
      <span className="measurement-notice__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 5.1A10.9 10.9 0 0 1 12 5c6 0 9.5 7 9.5 7a15.6 15.6 0 0 1-3.2 4M6.3 6.3A15.4 15.4 0 0 0 2.5 12S6 19 12 19a9.6 9.6 0 0 0 4.1-.9M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
      </span>
      <div className="measurement-notice__text">
        <strong>{copy.title}</strong>
        <p>{copy.body}</p>
      </div>
      {copy.action ? <Link className="measurement-notice__action" to={copy.action.to}>{copy.action.label}</Link> : null}
    </section>
  );
}
