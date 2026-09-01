import { useEffect, useRef, useState } from "react";

interface FlowNameEditorProps {
  readonly name: string;
  readonly onRename: (name: string) => void;
}

/**
 * FlowNameEditor — nombre de la automatización en la topbar, editable en línea.
 *
 * Responsabilidad única: alternar entre mostrar el nombre y editarlo, y
 * entregar un nombre válido. No sabe dónde se guarda: eso lo decide quien
 * recibe `onRename`.
 *
 * Vive aparte de `BuilderPage` porque tiene estado propio (modo vista/edición,
 * borrador) y manejo de teclado; embeberlo convertiría la página en un
 * formulario.
 *
 * Al salir del campo NO se guarda nada. El patrón de renombrado que ya existe
 * en el hub (`RenameFlowModal`) exige confirmación explícita, y guardar en el
 * blur haría que un clic accidental en cualquier punto del builder renombrara
 * la automatización sin que el usuario lo pidiera.
 */
export function FlowNameEditor({ name, onRename }: FlowNameEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      return;
    }

    // `focus()` explícito además de `select()`: seleccionar el texto no implica
    // dar el foco, y sin foco no funcionan ni Enter ni Escape.
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  function startEditing(): void {
    setDraft(name);
    setEditing(true);
  }

  function cancelEditing(): void {
    setDraft(name);
    setEditing(false);
  }

  function confirmEditing(event: React.FormEvent): void {
    event.preventDefault();

    // Un nombre vacío o sólo espacios no es un nombre: se ignora y el campo
    // sigue abierto para que el usuario lo corrija.
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      return;
    }

    if (trimmed !== name) {
      onRename(trimmed);
    }

    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="builder-topbar__flow-name">
        <span className="builder-topbar__name" title={name}>
          {name}
        </span>
        <button
          type="button"
          className="builder-topbar__rename"
          onClick={startEditing}
          aria-label="Editar nombre de automatización"
          title="Editar nombre de automatización"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M13.5 3.5a1.9 1.9 0 0 1 2.7 2.7L7.4 15 3.5 16.5 5 12.6z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <form
      className="builder-topbar__flow-name builder-topbar__flow-name--editing"
      onSubmit={confirmEditing}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          cancelEditing();
        }
      }}
    >
      <input
        ref={inputRef}
        type="text"
        className="builder-topbar__name-input"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={120}
        aria-label="Nombre de la automatización"
        autoComplete="off"
      />
      <button
        type="submit"
        className="builder-topbar__name-action"
        disabled={draft.trim().length === 0}
        aria-label="Guardar nombre"
        title="Guardar nombre"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="4 10.5 8 14.5 16 6" />
        </svg>
      </button>
      <button
        type="button"
        className="builder-topbar__name-action"
        onClick={cancelEditing}
        aria-label="Cancelar edición"
        title="Cancelar edición"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <line x1="5" y1="5" x2="15" y2="15" />
          <line x1="15" y1="5" x2="5" y2="15" />
        </svg>
      </button>
    </form>
  );
}
