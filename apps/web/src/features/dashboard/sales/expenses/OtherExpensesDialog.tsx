import "./other-expenses.css";
import { useId, useState } from "react";
import type { OtherExpenseCharge } from "@contracts/DashboardContracts";
import type { OtherExpenseSummary } from "@contracts/OtherExpenseContracts";
import { useSalesLines } from "@shared/sales-lines/useSalesLines";
import { money } from "../../dashboardFormat";
import { expenseLine, totalLabel } from "./expenseWords";
import { OtherExpenseForm } from "./OtherExpenseForm";
import { useOtherExpenses } from "./useOtherExpenses";

/** `undefined`: sin formulario abierto · `null`: uno nuevo · un gasto: editarlo. */
type Editing = OtherExpenseSummary | null | undefined;

/**
 * Otros gastos: lo que se paga fuera de Meta. La lista con cuánto costó cada
 * uno en el periodo que se mira, el total y, para quien puede, crear, editar
 * y borrar. Al guardar, el Dashboard vuelve a calcular la ganancia.
 */
export function OtherExpensesDialog({ charges, total, currency, periodWords, lineId, onChanged, onClose }: {
  readonly charges: ReadonlyArray<OtherExpenseCharge>;
  readonly total: number;
  readonly currency: string;
  readonly periodWords: string;
  /** La línea que se mira (los gastos nuevos van a ella por defecto). */
  readonly lineId: string | null;
  readonly onChanged: () => void;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const { expenses, canManage, failed, save, remove } = useOtherExpenses(onChanged);
  const { lines } = useSalesLines();
  const [editing, setEditing] = useState<Editing>(undefined);
  const [dismissed, setDismissed] = useState(false);
  const lineOf = (id: string | null) => (id ? lines.find((line) => line.id === id) ?? null : null);
  // Sin gastos todavía, el formulario ya está abierto.
  const formFor: Editing = editing === undefined && !dismissed && expenses?.length === 0 && canManage ? null : editing;

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onClose}>
      <div className="ui-dialog other-expenses" onClick={(event) => event.stopPropagation()}>
        <h2 id={titleId}>Otros gastos</h2>
        <p className="ui-muted other-expenses__intro">
          Lo que pagas fuera de Meta: herramientas, sueldos, la comisión de la pasarela… Se resta de la ganancia; el ROAS sigue siendo solo contra Meta.
        </p>
        {failed ? <p className="ui-error" role="alert">No pudimos cargar tus gastos. Cierra y vuelve a intentarlo.</p> : null}
        {!expenses && !failed ? <div className="other-expenses__loading" aria-busy="true" aria-label="Cargando gastos" /> : null}
        {expenses && expenses.length > 0 ? (
          <>
            <ul className="other-expenses__list">
              {expenses.map((expense) => {
                const line = lineOf(expense.lineId);
                const charge = charges.find((item) => item.id === expense.id);
                return (
                  <li key={expense.id}>
                    <button type="button" className="other-expenses__item" disabled={!canManage} onClick={() => setEditing(expense)} aria-label={canManage ? `Editar ${expense.name}` : expense.name}>
                      <span className="other-expenses__dot" style={{ background: line?.color ?? "var(--primary)" }} aria-hidden="true" />
                      <span className="other-expenses__text">
                        <strong>{expense.name}</strong>
                        <small>{expenseLine(expense, line?.name ?? null)}</small>
                      </span>
                      <span className="other-expenses__amount">
                        {charge ? money(charge.amount, currency) : "—"}
                        {/* Sin línea cuentan todos: si falta, el Dashboard aún lo está calculando. */}
                        <small>{charge ? "en el periodo" : lineId ? "no cuenta en esta línea" : "calculando…"}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="other-expenses__total">
              <span>{totalLabel(periodWords)}</span>
              <strong>{money(total, currency)}</strong>
            </div>
          </>
        ) : null}
        {expenses && expenses.length === 0 && !canManage ? <p className="ui-muted">Aún no hay otros gastos.</p> : null}
        {canManage && formFor !== undefined ? (
          <OtherExpenseForm
            key={formFor?.id ?? "new"}
            expense={formFor}
            lines={lines}
            defaultLineId={lineId}
            defaultCurrency={currency}
            onSave={(request) => save(request, formFor?.id)}
            onDelete={formFor ? () => remove(formFor.id) : null}
            onCancel={() => {
              setEditing(undefined);
              setDismissed(true);
            }}
          />
        ) : null}
        <div className="ui-dialog__footer">
          {canManage && formFor === undefined && expenses ? (
            <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setEditing(null)}>＋ Nuevo gasto</button>
          ) : null}
          <button type="button" className="ui-btn ui-btn--primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
