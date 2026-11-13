import { Link } from "react-router-dom";
import type { BusinessDataUse } from "@contracts/BusinessDataContracts";

const KIND: Readonly<Record<BusinessDataUse["kind"], string>> = { flow: "Flujo", broadcast: "Difusión por enviar", quickReply: "Respuesta rápida" };

const titleOf = (use: BusinessDataUse) => (use.kind === "flow" ? use.blockName : use.kind === "broadcast" ? use.name : `/${use.shortcut}`);
const detailOf = (use: BusinessDataUse) => (use.kind === "flow" ? `${KIND.flow} «${use.flowName}»` : KIND[use.kind]);
const linkOf = (use: BusinessDataUse) =>
  use.kind === "flow" ? `/builder/${encodeURIComponent(use.flowKey)}` : use.kind === "broadcast" ? "/broadcasts" : "/settings/quick-replies";

/** Dónde aparece: cada bloque, difusión por enviar o respuesta rápida, con un enlace para abrirlo. */
export function DatumUses({ uses, empty }: { readonly uses: ReadonlyArray<BusinessDataUse>; readonly empty: string }) {
  if (uses.length === 0) return <p className="bd-uses__empty">{empty}</p>;
  return (
    <ul className="bd-uses">
      {uses.map((use, index) => (
        <li key={`${use.kind}-${index}`} className="bd-uses__item">
          <span className={`bd-uses__dot bd-uses__dot--${use.kind}`} aria-hidden="true" />
          <span className="bd-uses__text">
            <strong>{titleOf(use)}</strong>
            <span>{detailOf(use)}</span>
          </span>
          <Link className="bd-uses__open" to={linkOf(use)} aria-label={`Abrir ${titleOf(use)}`}>Abrir</Link>
        </li>
      ))}
    </ul>
  );
}
