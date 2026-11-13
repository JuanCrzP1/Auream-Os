import "./field-picker.css";
import { useId, useMemo, useState, type KeyboardEvent, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import type { ContactFieldSummary } from "@contracts/ContactFieldContracts";
import { coerceFieldValue, foldAnswer } from "@contracts/FieldValues";
import { FieldCreateFailed, NewFieldDialog } from "@shared/contact-fields/NewFieldDialog";
import { TypeChip } from "@shared/contact-fields/TypeChip";
import type { ToolCapabilities, ToolContactFields } from "../ToolResources";

// ---------------------------------------------------------------------------
// Elegir un Campo del cliente en un bloque (en vez de escribir la clave a
// mano). Se busca por nombre o clave, se crea uno ahí mismo (dueños y
// administradores) o se deja «solo en esta conversación» (un dato de paso que
// no va a la ficha). Se abre EN LÍNEA: dentro del lienzo una lista flotante
// quedaría recortada por el bloque.
// ---------------------------------------------------------------------------

/** Los valores (p. ej. las opciones de un Menú) que no encajan en el tipo del campo: esos no llegarían a la ficha. */
export function valuesThatDontFit(field: ContactFieldSummary | undefined, values: ReadonlyArray<string>): string[] {
  if (!field || field.type === "text") return [];
  return values.filter((value) => value.trim() && coerceFieldValue(field, value) === undefined);
}

export function findField(fields: ToolContactFields | undefined, key: string): ContactFieldSummary | undefined {
  return key ? fields?.fields.find((field) => field.key === key) : undefined;
}

const stop = (event: SyntheticEvent) => event.stopPropagation();

const percent = (field: ContactFieldSummary, total: number) => (total > 0 ? `${Math.round((field.filled / total) * 100)} %` : "");

export function FieldPicker({
  label,
  value,
  onChange,
  contactFields,
  createField,
  hint,
  emptyLabel = "Elige un campo",
  clearLabel
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (key: string) => void;
  readonly contactFields: ToolContactFields | undefined;
  readonly createField?: ToolCapabilities["createContactField"];
  readonly hint?: string;
  /** Lo que dice cuando aún no se eligió nada. */
  readonly emptyLabel?: string;
  /** Si se puede dejar sin elegir (p. ej. «No guardar»): la acción que lo quita. */
  readonly clearLabel?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState<string | null>(null);
  const [freeKey, setFreeKey] = useState(false);
  const selected = findField(contactFields, value);
  // Mientras los campos cargan, una clave que quizá sea un campo no se marca como «solo de la conversación».
  const loading = contactFields?.status === "loading" && contactFields.fields.length === 0;
  const conversationOnly = freeKey || (value !== "" && !selected && !loading);
  const canCreate = Boolean(createField && contactFields?.canManage);
  const matches = useMemo(() => {
    const wanted = foldAnswer(query);
    return (contactFields?.fields ?? []).filter((field) => !wanted || foldAnswer(`${field.label} ${field.key}`).includes(wanted));
  }, [contactFields?.fields, query]);

  const pick = (key: string) => {
    onChange(key);
    setFreeKey(false);
    setOpen(false);
    setQuery("");
  };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, Math.min(matches.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const field = matches[active];
      if (field) pick(field.key);
      else if (canCreate && query.trim()) setCreating(query.trim());
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="kit-field kit-picker">
      <span className="kit-label" id={`${id}-label`}>{label}</span>
      <button type="button" className="kit-input kit-picker__trigger nodrag" aria-haspopup="listbox" aria-expanded={open} aria-labelledby={`${id}-label`} onClick={() => setOpen(!open)}>
        {selected ? (
          <>
            <span className="kit-picker__name">{selected.label}</span>
            <TypeChip type={selected.type} options={selected.options} />
            <code>{`{${selected.key}}`}</code>
          </>
        ) : value ? (
          <>
            <code>{`{${value}}`}</code>
            {loading ? null : <span className="kit-picker__tag">Solo en esta conversación</span>}
          </>
        ) : (
          <span className="kit-picker__empty">{emptyLabel}</span>
        )}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {open ? (
        <div className="kit-picker__panel">
          <input
            className="kit-input nodrag"
            value={query}
            placeholder="Buscar o crear un campo"
            aria-label="Buscar o crear un campo"
            aria-controls={`${id}-list`}
            autoFocus
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
          />
          <div className="kit-picker__list nowheel" role="listbox" id={`${id}-list`} aria-label="Campos del cliente">
            {contactFields?.status === "loading" && matches.length === 0 ? <p className="kit-picker__note">Cargando campos…</p> : null}
            {contactFields?.status === "ready" && matches.length === 0 ? <p className="kit-picker__note">{query ? `Ningún campo se llama «${query}».` : "Aún no hay campos del cliente."}</p> : null}
            {matches.map((field, index) => (
              <button key={field.id} type="button" role="option" aria-selected={field.key === value} className={`kit-picker__option nodrag${index === active ? " is-active" : ""}`} onClick={() => pick(field.key)}>
                <span className="kit-picker__name">{field.label}</span>
                <TypeChip type={field.type} options={field.options} />
                <span className="kit-picker__fill">{percent(field, contactFields?.totalContacts ?? 0)}</span>
              </button>
            ))}
          </div>
          {canCreate ? (
            <button type="button" className="kit-picker__action nodrag" onClick={() => setCreating(query.trim())}>
              + {query.trim() ? `Crear el campo «${query.trim()}»` : "Crear un campo nuevo"}
            </button>
          ) : null}
          <button
            type="button"
            className="kit-picker__action kit-picker__action--quiet nodrag"
            onClick={() => {
              setFreeKey(true);
              setOpen(false);
            }}
          >
            Solo en esta conversación
            <span>Un dato de paso (un código, una nota): no queda en la ficha.</span>
          </button>
          {clearLabel && value ? (
            <button type="button" className="kit-picker__action kit-picker__action--quiet nodrag" onClick={() => pick("")}>
              {clearLabel}
            </button>
          ) : null}
        </div>
      ) : null}

      {conversationOnly && !open ? (
        <input
          className="kit-input kit-input--mono nodrag"
          value={value}
          placeholder="clave, p. ej. codigo_promo"
          aria-label="Clave en la conversación"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange(event.target.value.trim())}
        />
      ) : null}
      {hint ? <p className="kit-hint">{hint}</p> : null}

      {/* Fuera del lienzo (que está transformado por el zoom) y sin que sus clics o teclas lleguen al bloque. */}
      {creating !== null && createField
        ? createPortal(
            <div className="nodrag nowheel" onClick={stop} onKeyDown={stop} onMouseDown={stop}>
              <NewFieldDialog
                initialLabel={creating}
                onClose={() => setCreating(null)}
                onCreate={async (request) => {
                  const outcome = await createField(request);
                  if (!outcome.ok) throw new FieldCreateFailed(outcome.message);
                  pick(outcome.value.key);
                }}
              />
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
