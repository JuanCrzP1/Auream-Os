import "./other-expenses.css";
import { useState } from "react";
import { EXPENSE_FREQUENCIES, EXPENSE_NAME_MAX, type ExpenseFrequency, type ExpenseKind, type OtherExpenseSummary, type SaveOtherExpenseRequest } from "@contracts/OtherExpenseContracts";
import type { SalesLineSummary } from "@contracts/SalesLineContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { CURRENCY_OPTIONS } from "../../scope/currencyOptions";
import { amountText, draftSentence, FREQUENCY_LABELS } from "./expenseWords";

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/**
 * Crear o editar un gasto: nombre, monto fijo (moneda y cada cuánto) o % de
 * las ventas, desde y hasta cuándo, y si es de todo el negocio o de una
 * línea. Abajo, en una frase, lo que se va a restar. Al editar, se puede borrar.
 */
export function OtherExpenseForm({ expense, lines, defaultLineId, defaultCurrency, onSave, onDelete, onCancel }: {
  readonly expense: OtherExpenseSummary | null;
  readonly lines: ReadonlyArray<SalesLineSummary>;
  readonly defaultLineId: string | null;
  readonly defaultCurrency: string;
  readonly onSave: (request: SaveOtherExpenseRequest) => Promise<unknown>;
  readonly onDelete: (() => Promise<unknown>) | null;
  readonly onCancel: () => void;
}) {
  const [name, setName] = useState(expense?.name ?? "");
  const [kind, setKind] = useState<ExpenseKind>(expense?.kind ?? "fixed");
  const [amount, setAmount] = useState(expense ? amountText(expense.amount) : "");
  const [currency, setCurrency] = useState(expense?.currency ?? defaultCurrency);
  const [frequency, setFrequency] = useState<ExpenseFrequency>(expense?.frequency ?? "monthly");
  const [startsOn, setStartsOn] = useState(expense?.startsOn ?? today());
  const [endsOn, setEndsOn] = useState(expense?.endsOn ?? "");
  const [lineId, setLineId] = useState(expense ? expense.lineId ?? "" : defaultLineId ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lineName = lines.find((line) => line.id === lineId)?.name ?? null;
  const sentence = name.trim() ? draftSentence({ kind, amount, currency, frequency, startsOn, endsOn, lineName }) : null;

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onCancel();
    } catch (e) {
      setError(apiErrorMessage(e, fallback));
      setBusy(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const request: SaveOtherExpenseRequest = {
      name: name.trim(),
      kind,
      amount: amount.trim(),
      currency: kind === "fixed" ? currency : null,
      frequency: kind === "fixed" ? frequency : null,
      startsOn,
      endsOn: endsOn || null,
      lineId: lineId || null
    };
    void run(() => onSave(request), "No se pudo guardar el gasto. Inténtalo de nuevo.");
  };

  return (
    <form className="other-expense-form" onSubmit={submit} aria-label={expense ? "Editar gasto" : "Nuevo gasto"}>
      <strong className="other-expense-form__title">{expense ? "Editar gasto" : "＋ Nuevo gasto"}</strong>
      <label className="ui-field">
        <span>Nombre</span>
        <input className="ui-input" value={name} maxLength={EXPENSE_NAME_MAX} placeholder="Ej.: Comisión de la pasarela" autoFocus onChange={(event) => setName(event.target.value)} />
      </label>
      <div className="ui-field">
        <span>Tipo</span>
        <div className="other-expense-form__seg" role="group" aria-label="Tipo">
          <button type="button" aria-pressed={kind === "fixed"} onClick={() => setKind("fixed")}>Monto fijo</button>
          <button type="button" aria-pressed={kind === "percent"} onClick={() => setKind("percent")}>% de las ventas</button>
        </div>
      </div>
      <div className="other-expense-form__row">
        <label className="ui-field">
          <span>{kind === "percent" ? "Porcentaje" : "Valor"}</span>
          <input className="ui-input" inputMode="decimal" value={amount} placeholder={kind === "percent" ? "Ej.: 3,5" : "Ej.: 1.200.000"} onChange={(event) => setAmount(event.target.value)} />
        </label>
        {kind === "fixed" ? (
          <label className="ui-field">
            <span>Moneda</span>
            <select className="ui-input" value={currency} onChange={(event) => setCurrency(event.target.value)}>
              {CURRENCY_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>{`${option.flag} ${option.code} · ${option.name}`}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {kind === "fixed" ? (
        <div className="ui-field">
          <span>Cada cuánto</span>
          <div className="other-expense-form__seg" role="group" aria-label="Cada cuánto">
            {EXPENSE_FREQUENCIES.map((option) => (
              <button key={option} type="button" aria-pressed={frequency === option} onClick={() => setFrequency(option)}>{FREQUENCY_LABELS[option]}</button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="other-expense-form__row">
        <label className="ui-field">
          <span>{kind === "fixed" && frequency === "once" ? "Fecha" : "Desde"}</span>
          <input className="ui-input" type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} />
        </label>
        {kind === "fixed" && frequency === "once" ? null : (
          <label className="ui-field">
            <span>Hasta (opcional)</span>
            <input className="ui-input" type="date" value={endsOn} min={startsOn} onChange={(event) => setEndsOn(event.target.value)} />
          </label>
        )}
      </div>
      <label className="ui-field">
        <span>Se aplica a</span>
        <select className="ui-input" value={lineId} onChange={(event) => setLineId(event.target.value)}>
          <option value="">Todo el negocio</option>
          {lines.map((line) => (
            <option key={line.id} value={line.id}>{`● ${line.name}`}</option>
          ))}
        </select>
      </label>
      <p className="other-expense-form__summary">{sentence ? `✓ ${sentence}` : "Ponle un nombre y escribe el valor."}</p>
      {error ? <p className="ui-error" role="alert">{error}</p> : null}
      <div className="other-expense-form__actions">
        {onDelete ? (
          <button type="button" className="ui-btn ui-btn--ghost other-expense-form__delete" disabled={busy} onClick={() => (confirmDelete ? void run(onDelete, "No se pudo borrar el gasto.") : setConfirmDelete(true))}>
            {confirmDelete ? "¿Seguro? Borrar gasto" : "Borrar gasto"}
          </button>
        ) : null}
        <button type="button" className="ui-btn ui-btn--ghost" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button type="submit" className="ui-btn ui-btn--primary" disabled={busy || !sentence}>{busy ? "Guardando…" : "Guardar gasto"}</button>
      </div>
    </form>
  );
}
