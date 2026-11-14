import "./variable-picker.css";
import { useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { foldAnswer } from "@contracts/FieldValues";
import { insertVariable, placeCaret } from "./insertVariable";
import { useVariableSources } from "./VariableSources";

type TextElement = HTMLInputElement | HTMLTextAreaElement;

/**
 * Un campo que acepta variables: su referencia (para saber dónde está el
 * cursor), si la lista está abierta y qué hacer al elegir una. La lista se
 * pinta en línea, debajo del campo: dentro del lienzo una flotante quedaría
 * recortada (igual que el selector de campos).
 */
export function useVariableInsertion<T extends TextElement>(value: string, onChange: (value: string) => void, external?: RefObject<T>) {
  const own = useRef<T>(null);
  const ref = external ?? own;
  const [open, setOpen] = useState(false);
  // Al tocar el botón el campo pierde el foco: se recuerda dónde estaba el cursor.
  const lastSelection = useRef<{ start: number | null; end: number | null } | null>(null);
  const pick = (name: string) => {
    const element = ref.current;
    const selection = element && document.activeElement === element ? { start: element.selectionStart, end: element.selectionEnd } : lastSelection.current;
    const next = insertVariable(value, `{${name}}`, selection);
    onChange(next.value);
    setOpen(false);
    placeCaret(element, next.caret);
  };
  // Solo si estaba escribiendo ahí (el botón no le quita el foco); si no, al final.
  const remember = () => {
    const element = ref.current;
    lastSelection.current = element && document.activeElement === element ? { start: element.selectionStart, end: element.selectionEnd } : null;
  };
  return { ref, open, toggle: () => (remember(), setOpen((current) => !current)), close: () => setOpen(false), pick };
}

/** El botón «{ } Variables» junto a un campo. */
export function VariableToggle({ open, onToggle, label = "Variables" }: { readonly open: boolean; readonly onToggle: () => void; readonly label?: string }) {
  return (
    <button type="button" className={`kit-variables-toggle nodrag${open ? " is-open" : ""}`} aria-expanded={open} onMouseDown={(event) => event.preventDefault()} onClick={onToggle}>
      <span aria-hidden="true">{"{ }"}</span>
      {label || <span className="kit-sr-only">Insertar variable</span>}
    </button>
  );
}

/** La lista de variables, con buscador y por grupos. Elegir una la inserta donde estaba el cursor. */
export function VariableMenu({ onPick, onClose }: { readonly onPick: (name: string) => void; readonly onClose: () => void }) {
  const searchId = useId();
  const groups = useVariableSources();
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const wanted = foldAnswer(query);
    if (!wanted) return groups;
    return groups
      .map((group) => ({ ...group, variables: group.variables.filter((variable) => foldAnswer(`${variable.name} ${variable.label}`).includes(wanted)) }))
      .filter((group) => group.variables.length > 0);
  }, [groups, query]);
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") onClose();
    if (event.key === "Enter") {
      event.preventDefault();
      const first = shown[0]?.variables[0];
      if (first) onPick(first.name);
    }
  };

  return (
    <div className="kit-variables nodrag nowheel" role="dialog" aria-label="Elegir una variable">
      <input id={searchId} className="kit-input kit-variables__search" type="search" value={query} placeholder="Buscar variable…" aria-label="Buscar variable" autoFocus onKeyDown={onKey} onChange={(event) => setQuery(event.target.value)} />
      <div className="kit-variables__list">
        {shown.length === 0 ? <p className="kit-variables__empty">Ninguna se llama así. Puedes escribirla entre llaves: {"{mi_dato}"}.</p> : null}
        {shown.map((group) => (
          <section key={group.id} className="kit-variables__group" aria-label={group.title}>
            <h4>{group.title}</h4>
            {group.variables.map((variable) => (
              <button key={variable.name} type="button" className="kit-variables__option" onMouseDown={(event) => event.preventDefault()} onClick={() => onPick(variable.name)}>
                <code>{`{${variable.name}}`}</code>
                <span>{variable.label}</span>
              </button>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

/** Botón y lista debajo de un campo propio (el texto del Mensaje, su leyenda o su enlace). */
export function VariableBar({ picker }: { readonly picker: ReturnType<typeof useVariableInsertion> }) {
  return (
    <>
      <div className="kit-variables-bar">
        <VariableToggle open={picker.open} onToggle={picker.toggle} />
      </div>
      {picker.open ? <VariableMenu onPick={picker.pick} onClose={picker.close} /> : null}
    </>
  );
}
