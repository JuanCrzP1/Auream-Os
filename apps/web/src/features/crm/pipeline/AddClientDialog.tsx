import "@shared/ui/controls/controls.css";
import "./crm-dialogs.css";
import { useEffect, useId, useState } from "react";
import type { ContactSummary } from "@contracts/ContactContracts";
import type { StageSummary } from "@contracts/CrmContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { createContact, fetchContacts } from "../contacts/services/contactsApi";

/**
 * Agregar un cliente al embudo: se busca entre los contactos (o se crea uno
 * con su número) y se elige en qué etapa entra.
 */
export function AddClientDialog({
  stages,
  onAdd,
  onClose
}: {
  readonly stages: ReadonlyArray<StageSummary>;
  readonly onAdd: (contactId: string, stageId: string) => Promise<void>;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ReadonlyArray<ContactSummary>>([]);
  const [picked, setPicked] = useState<ContactSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [stageId, setStageId] = useState(stages.find((stage) => stage.outcome === "open")?.id ?? stages[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (creating) return;
    const timer = window.setTimeout(() => {
      fetchContacts({ search, limit: 8 })
        .then((response) => setResults(response.contacts))
        .catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, creating]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const contact = creating ? await createContact({ phone, ...(name.trim() ? { name } : {}) }) : picked;
      if (!contact) throw new Error("Elige un contacto.");
      await onAdd(contact.id, stageId);
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo agregar el cliente."));
      setBusy(false);
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <form className="ui-dialog crm-dialog" onClick={(event) => event.stopPropagation()} onSubmit={(event) => void submit(event)}>
        <h2 id={titleId}>Agregar cliente al embudo</h2>
        {creating ? (
          <>
            <label className="ui-field">
              <span>Teléfono (con código de país)</span>
              <input className="ui-input" value={phone} placeholder="+57 300 123 4567" onChange={(event) => setPhone(event.target.value)} autoFocus />
            </label>
            <label className="ui-field">
              <span>Nombre (opcional)</span>
              <input className="ui-input" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <button type="button" className="ui-link crm-dialog__switch" onClick={() => setCreating(false)}>Buscar un contacto que ya existe</button>
          </>
        ) : (
          <>
            <label className="ui-field">
              <span>Buscar contacto</span>
              <input className="ui-input" type="search" value={search} placeholder="Nombre o teléfono" onChange={(event) => setSearch(event.target.value)} autoFocus />
            </label>
            <div className="crm-dialog__results" role="listbox" aria-label="Contactos">
              {results.length === 0 ? <p className="ui-muted">Sin resultados.</p> : null}
              {results.map((contact) => (
                <button key={contact.id} type="button" role="option" aria-selected={picked?.id === contact.id} className="crm-dialog__result" onClick={() => setPicked(contact)}>
                  <strong>{contact.name ?? "Sin nombre"}</strong>
                  <span>{contact.phone ? `+${contact.phone}` : ""}</span>
                </button>
              ))}
            </div>
            <button type="button" className="ui-link crm-dialog__switch" onClick={() => setCreating(true)}>¿No está? Crear un contacto nuevo</button>
          </>
        )}
        <label className="ui-field">
          <span>Entra en la etapa</span>
          <select className="ui-input" value={stageId} onChange={(event) => setStageId(event.target.value)}>
            {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </select>
        </label>
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={busy || (!creating && !picked) || (creating && !phone.trim())}>{busy ? "Agregando…" : "Agregar"}</button>
        </div>
      </form>
    </div>
  );
}
