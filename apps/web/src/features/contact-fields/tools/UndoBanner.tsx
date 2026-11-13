import "./field-tools.css";
import { useState } from "react";
import type { FieldOperationSummary } from "@contracts/ContactFieldToolsContracts";
import { undoFieldOperation } from "@shared/contact-fields/contactFieldsApi";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { clients } from "../fieldText";

const daysLeft = (until: string) => Math.max(1, Math.ceil((Date.parse(until) - Date.now()) / 86_400_000));

/** Lo que se ordenó o unió en los últimos días, con «Deshacer» (devuelve lo que siga como quedó). */
export function UndoBanner({ operations, onUndone }: { readonly operations: ReadonlyArray<FieldOperationSummary>; readonly onUndone: () => Promise<unknown> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  if (operations.length === 0 && !note) return null;

  const undo = async (operation: FieldOperationSummary) => {
    setBusy(operation.id);
    setNote(null);
    try {
      const result = await undoFieldOperation(operation.id);
      setNote(`Listo: ${clients(result.contacts)} ${result.contacts === 1 ? "volvió" : "volvieron"} a como estaba${result.blocksSkipped > 0 ? `; ${result.blocksSkipped} ${result.blocksSkipped === 1 ? "bloque cambió" : "bloques cambiaron"} después y no se tocaron` : ""}.`);
      await onUndone();
    } catch (failure) {
      setNote(apiErrorMessage(failure, "No se pudo deshacer. Inténtalo de nuevo."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="ft-undo" aria-label="Cambios recientes">
      {operations.map((operation) => (
        <div key={operation.id} className="ft-undo__row">
          <span>
            <strong>{operation.title}</strong>
            <span>{clients(operation.contacts)} · se puede deshacer {daysLeft(operation.undoUntil) === 1 ? "hoy" : `${daysLeft(operation.undoUntil)} días más`}</span>
          </span>
          <button type="button" className="cf-soft-btn" disabled={busy !== null} onClick={() => void undo(operation)}>{busy === operation.id ? "Deshaciendo…" : "Deshacer"}</button>
        </div>
      ))}
      {note ? <p className="ft-undo__note" role="status">{note}</p> : null}
    </section>
  );
}
