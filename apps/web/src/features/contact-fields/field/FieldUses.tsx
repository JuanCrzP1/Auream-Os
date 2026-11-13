import "./field-drawer.css";
import { Link } from "react-router-dom";
import type { FieldUse } from "@contracts/ContactFieldContracts";

/** Los bloques que llenan o leen un campo, cada uno con su enlace al flujo. */
export function FieldUses({ uses, empty, verb }: { readonly uses: ReadonlyArray<FieldUse>; readonly empty: string; readonly verb?: boolean }) {
  if (uses.length === 0) return <p className="cf-uses__empty">{empty}</p>;
  return (
    <ul className="cf-uses">
      {uses.map((use) => (
        <li key={`${use.flowKey}:${use.blockId}:${use.role}`} className="cf-uses__item">
          <span className={`cf-uses__dot cf-uses__dot--${use.role}`} aria-hidden="true" />
          <span className="cf-uses__text">
            <strong>{use.blockName}</strong>
            <span>
              {`Flujo «${use.flowName}»`}
              {verb ? (use.role === "fills" ? " · lo llena" : " · lo lee") : ""}
            </span>
          </span>
          <Link className="cf-uses__open" to={`/builder/${encodeURIComponent(use.flowKey)}`}>Abrir</Link>
        </li>
      ))}
    </ul>
  );
}
