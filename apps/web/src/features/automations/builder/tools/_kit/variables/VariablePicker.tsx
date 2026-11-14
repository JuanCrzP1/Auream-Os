import "./variable-picker.css";
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { foldAnswer } from "@contracts/FieldValues";
import { insertVariable, placeCaret } from "./insertVariable";
import { useVariableSources } from "./VariableSources";
import { VariablePopover } from "./VariablePopover";

type TextElement = HTMLInputElement | HTMLTextAreaElement;

/**
 * Un campo que acepta variables, como en Leona: un ícono «{ }» dentro del
 * campo, en su esquina derecha, y la lista flotando encima (no empuja el
 * formulario). Da la referencia del campo (para saber dónde está el cursor),
 * la de su caja (para anclar la lista), si está abierta y qué hacer al elegir.
 */
export function useVariableInsertion<T extends TextElement>(value: string, onChange: (value: string) => void, external?: RefObject<T>) {
  const own = useRef<T>(null);
  const ref = external ?? own;
  const host = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Al abrir la lista el buscador toma el foco: se recuerda dónde estaba el cursor.
  const lastSelection = useRef<{ start: number | null; end: number | null } | null>(null);
  const pick = (name: string) => {
    const element = ref.current;
    const selection = element && document.activeElement === element ? { start: element.selectionStart, end: element.selectionEnd } : lastSelection.current;
    const next = insertVariable(value, `{${name}}`, selection);
    onChange(next.value);
    setOpen(false);
    placeCaret(element, next.caret);
  };
  // Solo si estaba escribiendo ahí (el ícono no le quita el foco); si no, al final.
  const remember = () => {
    const element = ref.current;
    lastSelection.current = element && document.activeElement === element ? { start: element.selectionStart, end: element.selectionEnd } : null;
  };
  return { ref, host, open, toggle: () => (remember(), setOpen((current) => !current)), close: () => setOpen(false), pick };
}

export type VariableInsertion = ReturnType<typeof useVariableInsertion>;

/**
 * La caja del campo con su ícono en la esquina: a la derecha en una línea,
 * abajo a la derecha en un texto largo. Sin `picker`, el campo queda tal cual.
 */
export function VariableHost({ picker, multiline, children }: { readonly picker: VariableInsertion | undefined; readonly multiline?: boolean; readonly children: ReactNode }) {
  if (!picker) return <>{children}</>;
  return (
    <div ref={picker.host} className={`kit-var-host${multiline ? " kit-var-host--multiline" : ""}`}>
      {children}
      <button
        type="button"
        className={`kit-var-corner nodrag${picker.open ? " is-open" : ""}`}
        aria-label="Insertar variable"
        title="Insertar variable"
        aria-expanded={picker.open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={picker.toggle}
      >
        <span aria-hidden="true">{"{ }"}</span>
      </button>
      {picker.open ? (
        <VariablePopover anchor={picker.host} onClose={picker.close}>
          <VariableMenu onPick={picker.pick} />
        </VariablePopover>
      ) : null}
    </div>
  );
}

/** La lista de variables, con buscador y por grupos. Elegir una la inserta donde estaba el cursor. */
export function VariableMenu({ onPick }: { readonly onPick: (name: string) => void }) {
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
    if (event.key === "Enter") {
      event.preventDefault();
      const first = shown[0]?.variables[0];
      if (first) onPick(first.name);
    }
  };

  return (
    <>
      <input className="kit-input kit-var-popover__search" type="search" value={query} placeholder="Buscar variable…" aria-label="Buscar variable" autoFocus onKeyDown={onKey} onChange={(event) => setQuery(event.target.value)} />
      <div className="kit-var-popover__list">
        {shown.length === 0 ? <p className="kit-var-popover__empty">Ninguna se llama así. Puedes escribirla entre llaves: {"{mi_dato}"}.</p> : null}
        {shown.map((group) => (
          <section key={group.id} className="kit-var-popover__group" aria-label={group.title}>
            <h4>{group.title}</h4>
            {group.variables.map((variable) => (
              <button key={variable.name} type="button" className="kit-var-popover__option" onMouseDown={(event) => event.preventDefault()} onClick={() => onPick(variable.name)}>
                <code>{`{${variable.name}}`}</code>
                <span>{variable.label}</span>
              </button>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
