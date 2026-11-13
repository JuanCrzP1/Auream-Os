import "./label-drawer.css";
import { Link } from "react-router-dom";
import type { LabelUse } from "@contracts/LabelManagementContracts";
import { useText } from "../labelText";

/** Dónde trabaja la etiqueta: la etapa, cada bloque, difusión, público, webhook o campaña, con su enlace. */
export function LabelUses({ uses, empty }: { readonly uses: ReadonlyArray<LabelUse>; readonly empty: string }) {
  if (uses.length === 0) return <p className="lb-uses__empty">{empty}</p>;
  return (
    <ul className="lb-uses">
      {uses.map((use, index) => {
        const text = useText(use);
        return (
          <li key={`${use.kind}-${index}`} className="lb-uses__item">
            <span className={`lb-uses__dot lb-uses__dot--${use.kind}`} aria-hidden="true" />
            <span className="lb-uses__text">
              <strong>{text.title}</strong>
              <span>{text.detail}</span>
            </span>
            <Link className="lb-uses__open" to={text.to} aria-label={`Abrir ${text.title}`}>Abrir</Link>
          </li>
        );
      })}
    </ul>
  );
}
