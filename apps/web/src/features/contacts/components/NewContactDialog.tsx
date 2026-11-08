import "@shared/ui/controls/controls.css";
import { useState } from "react";
import type { ContactSummary } from "@contracts/ContactContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { createContact } from "../services/contactsApi";

/** Alta manual de un contacto de WhatsApp (teléfono con código de país). */
export function NewContactDialog({ onCreated, onClose }: { readonly onCreated: (contact: ContactSummary) => void; readonly onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      onCreated(await createContact({ phone, ...(name.trim() ? { name } : {}), ...(email.trim() ? { email } : {}) }));
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo crear el contacto."));
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby="new-contact-title" onClick={onClose}>
      <form className="ui-dialog" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void submit(e)}>
        <h2 id="new-contact-title">Nuevo contacto</h2>
        <label className="ui-field">
          <span>Teléfono (con código de país)</span>
          <input className="ui-input" value={phone} placeholder="+57 300 123 4567" onChange={(e) => setPhone(e.target.value)} autoFocus />
        </label>
        <label className="ui-field">
          <span>Nombre</span>
          <input className="ui-input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="ui-field">
          <span>Correo</span>
          <input className="ui-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={phone.trim() === ""}>Crear</button>
        </div>
      </form>
    </div>
  );
}
