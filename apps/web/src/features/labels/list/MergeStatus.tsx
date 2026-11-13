import type { LabelMerge } from "@contracts/LabelManagementContracts";
import { labelDisplayName } from "../labelText";

/** Las uniones en curso (con su avance) y las que terminaron hace poco. */
export function MergeStatus({ merges }: { readonly merges: ReadonlyArray<LabelMerge> }) {
  if (merges.length === 0) return null;
  return (
    <section className="lb-merges" aria-label="Uniones">
      {merges.map((merge) => {
        const from = labelDisplayName(merge.fromName);
        const percent = merge.total > 0 ? Math.round((merge.moved / merge.total) * 100) : 100;
        return (
          <div key={merge.id} className={`lb-merge lb-merge--${merge.status}`} role="status">
            <span className="lb-merge__text">
              <strong>
                {merge.status === "running" ? "Uniendo" : merge.status === "done" ? "Listo:" : "No se pudo terminar:"} «{from}» en «{merge.intoName}»
              </strong>
              <span>
                {merge.status === "running"
                  ? `Pasaron ${merge.moved.toLocaleString("es-CO")} de ${merge.total.toLocaleString("es-CO")} clientes. Sus flujos, difusiones y webhooks ya usan «${merge.intoName}».`
                  : merge.status === "done"
                    ? `${merge.total.toLocaleString("es-CO")} clientes pasaron y «${from}» se borró.`
                    : `Los que ya pasaron se quedan en «${merge.intoName}». Vuelve a intentarlo desde la etiqueta.`}
              </span>
            </span>
            {merge.status === "running" ? (
              <span className="lb-merge__bar" aria-label={`${percent} %`}>
                <span style={{ width: `${percent}%` }} />
              </span>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
