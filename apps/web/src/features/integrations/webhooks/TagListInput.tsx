import { useId, useState } from "react";

/** Etiquetas por nombre (como el bloque Etiquetas): escribe y Enter, o elige una del catálogo; × para quitar. */
export function TagListInput({ label, value, suggestions, onChange }: { readonly label: string; readonly value: ReadonlyArray<string>; readonly suggestions: ReadonlyArray<string>; readonly onChange: (next: string[]) => void }) {
  const id = useId();
  const [text, setText] = useState("");
  const add = (name: string) => {
    const clean = name.trim().slice(0, 40);
    if (clean && !value.some((tag) => tag.toLowerCase() === clean.toLowerCase())) onChange([...value, clean]);
    setText("");
  };
  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      <div className="webhook-tags">
        {value.map((tag) => (
          <span key={tag} className="webhook-tags__chip">
            {tag}
            <button type="button" aria-label={`Quitar ${tag}`} onClick={() => onChange(value.filter((item) => item !== tag))}>×</button>
          </span>
        ))}
        <input
          id={id}
          className="webhook-tags__input"
          list={`${id}-catalog`}
          value={text}
          placeholder={value.length ? "" : "Buscar o crear etiqueta…"}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add(text);
            }
          }}
          onBlur={() => add(text)}
        />
        <datalist id={`${id}-catalog`}>
          {suggestions.filter((name) => !value.includes(name)).map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
