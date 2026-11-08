import { useState } from "react";
import { DEFAULT_LABEL_COLOR, type LabelSummary } from "@contracts/ContactContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { ColorSwatches } from "./ColorSwatches";
import { LabelChip } from "./LabelChip";
import { ContactsState, RetryButton } from "./ContactsState";
import type { LabelCatalogStatus } from "@shared/labels/useLabelCatalog";

interface LabelsManagerProps {
  readonly labels: ReadonlyArray<LabelSummary>;
  readonly status: LabelCatalogStatus;
  readonly onRetry: () => Promise<unknown>;
  readonly onCreate: (input: { name: string; color: string }) => Promise<unknown>;
  readonly onUpdate: (id: string, input: { name: string; color: string }) => Promise<unknown>;
  readonly onDelete: (id: string) => Promise<unknown>;
}

/** Fila editable de una etiqueta (nombre y color). */
function LabelRow({ label, onUpdate, onDelete }: { readonly label: LabelSummary } & Pick<LabelsManagerProps, "onUpdate" | "onDelete">) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const save = async () => {
    try {
      await onUpdate(label.id, { name, color });
      setEditing(false);
      setError(null);
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo guardar la etiqueta."));
    }
  };

  if (editing) {
    return (
      <li className="contacts-label-row contacts-label-row--editing">
        <input className="contacts-input" value={name} maxLength={40} aria-label="Nombre de la etiqueta" onChange={(e) => setName(e.target.value)} />
        <ColorSwatches value={color} onChange={setColor} />
        {error ? <p className="contacts-error" role="alert">{error}</p> : null}
        <div className="contacts-row-actions">
          <button type="button" className="contacts-btn contacts-btn--ghost" onClick={() => setEditing(false)}>Cancelar</button>
          <button type="button" className="contacts-btn contacts-btn--primary" onClick={() => void save()} disabled={name.trim() === ""}>Guardar</button>
        </div>
      </li>
    );
  }

  return (
    <li className="contacts-label-row">
      <LabelChip label={label} />
      <span className="contacts-muted">{label.contactCount ?? 0} contactos</span>
      <div className="contacts-row-actions">
        {confirming ? (
          <>
            <span className="contacts-muted">¿Borrarla de todos sus contactos?</span>
            <button type="button" className="contacts-btn contacts-btn--ghost" onClick={() => setConfirming(false)}>No</button>
            <button type="button" className="contacts-btn contacts-btn--danger" onClick={() => void onDelete(label.id)}>Sí, borrar</button>
          </>
        ) : (
          <>
            <button type="button" className="contacts-btn contacts-btn--ghost" onClick={() => setEditing(true)} aria-label={`Editar ${label.name}`}>Editar</button>
            <button type="button" className="contacts-btn contacts-btn--ghost" onClick={() => setConfirming(true)} aria-label={`Borrar ${label.name}`}>Borrar</button>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * Catálogo de etiquetas de la cuenta: crear, renombrar, recolorear y borrar.
 * Son las mismas que usan el bloque Etiquetas y las reglas del Condicional.
 */
export function LabelsManager({ labels, status, onRetry, onCreate, onUpdate, onDelete }: LabelsManagerProps) {
  const [retrying, setRetrying] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_LABEL_COLOR);
  const [error, setError] = useState<string | null>(null);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await onCreate({ name, color });
      setName("");
      setError(null);
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo crear la etiqueta."));
    }
  };

  return (
    <section className="contacts-panel" aria-label="Etiquetas">
      <form className="contacts-label-form" onSubmit={(e) => void create(e)}>
        <input className="contacts-input" value={name} maxLength={40} placeholder="Nueva etiqueta (ej. Cliente VIP)" aria-label="Nombre de la nueva etiqueta" onChange={(e) => setName(e.target.value)} />
        <ColorSwatches value={color} onChange={setColor} />
        <button type="submit" className="contacts-btn contacts-btn--primary" disabled={name.trim() === ""}>Crear etiqueta</button>
        {error ? <p className="contacts-error" role="alert">{error}</p> : null}
      </form>

      {status === "error" || retrying ? (
        <ContactsState
          role="alert"
          tone="warning"
          icon="offline"
          title="No pudimos cargar tus etiquetas"
          description="Parece un problema de conexión momentáneo. Vuelve a intentarlo en unos segundos."
          actions={
            <RetryButton
              busy={retrying}
              onRetry={() => {
                setRetrying(true);
                void onRetry().finally(() => setRetrying(false));
              }}
            />
          }
        />
      ) : labels.length === 0 && status === "ready" ? (
        <ContactsState
          icon="tag"
          title="Aún no tienes etiquetas"
          description="Créalas arriba para clasificar a tus contactos, o deja que el bloque Etiquetas de tus flujos las cree al usarlas."
        />
      ) : labels.length === 0 ? null : (
        <ul className="contacts-label-list">
          {labels.map((label) => (
            <LabelRow key={label.id} label={label} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </section>
  );
}
