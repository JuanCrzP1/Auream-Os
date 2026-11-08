import "./kit.css";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { useAutoHeight } from "./useAutoHeight";

// ---------------------------------------------------------------------------
// Primitivas de formulario de los editores. Sin estado de negocio: reciben un
// valor y devuelven el nuevo. El color lo pone la herramienta con
// `editorAccent(color)` vía `ToolEditorLayout`.
// ---------------------------------------------------------------------------

/** Variables CSS de acento para una herramienta. */
export function editorAccent(color: string): CSSProperties {
  return { "--kit-accent": color, "--kit-switch-accent": color } as CSSProperties;
}

/** Rótulo + control + pista. `children` recibe el id para enlazar el control. */
export function Field({
  label,
  hint,
  children
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: (id: string) => ReactNode;
}) {
  const id = useId();

  return (
    <div className="kit-field">
      <label className="kit-label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {hint ? <p className="kit-hint">{hint}</p> : null}
    </div>
  );
}

interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly hint?: string;
  readonly placeholder?: string;
  readonly type?: "text" | "url" | "tel" | "password" | "number" | "time" | "date";
  readonly monospace?: boolean;
  readonly invalid?: boolean;
  /** Límite de caracteres: muestra un contador y corta lo que sobre. */
  readonly maxLength?: number;
}

/** Contador «12/24» que se enciende al acercarse al límite. */
function CharCounter({ length, max }: { readonly length: number; readonly max: number }) {
  const state = length >= max ? " kit-counter-chars--full" : length >= max * 0.85 ? " kit-counter-chars--near" : "";
  return (
    <span className={`kit-counter-chars${state}`} aria-hidden="true">
      {length}/{max}
    </span>
  );
}

export function TextField({ label, value, onChange, hint, placeholder, type = "text", monospace, invalid, maxLength }: TextFieldProps) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <div className={maxLength ? "kit-input-wrap" : undefined}>
          <input
            id={id}
            type={type}
            className={`kit-input nodrag${monospace ? " kit-input--mono" : ""}${invalid ? " kit-input--invalid" : ""}`}
            value={value}
            placeholder={placeholder}
            maxLength={maxLength}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={invalid || undefined}
            onChange={(event) => onChange(event.target.value)}
          />
          {maxLength ? <CharCounter length={value.length} max={maxLength} /> : null}
        </div>
      )}
    </Field>
  );
}

/** Campo de texto suelto, sin rótulo propio (para filas de listas). */
export function InlineInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  monospace,
  maxLength,
  options
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly ariaLabel: string;
  readonly monospace?: boolean;
  readonly maxLength?: number;
  /** Valores que el navegador sugiere al escribir. Escribir otro sigue valiendo. */
  readonly options?: ReadonlyArray<string>;
}) {
  const listId = useId();
  const hasOptions = options !== undefined && options.length > 0;
  const input = (
    <input
      type="text"
      list={hasOptions ? listId : undefined}
      className={`kit-input nodrag${monospace ? " kit-input--mono" : ""}`}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      maxLength={maxLength}
      autoComplete="off"
      spellCheck={false}
      onChange={(event) => onChange(event.target.value)}
    />
  );
  const datalist = hasOptions ? (
    <datalist id={listId}>
      {options.map((option) => (
        <option key={option} value={option} />
      ))}
    </datalist>
  ) : null;

  return maxLength ? (
    <div className="kit-input-wrap">
      {input}
      {datalist}
      <CharCounter length={value.length} max={maxLength} />
    </div>
  ) : (
    <>
      {input}
      {datalist}
    </>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  monospace
}: Omit<TextFieldProps, "type" | "invalid">) {
  const ref = useAutoHeight(value);

  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <textarea
          id={id}
          ref={ref}
          className={`kit-textarea nodrag nowheel${monospace ? " kit-input--mono" : ""}`}
          value={value}
          placeholder={placeholder}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

export interface Option<T extends string> {
  readonly value: T;
  readonly label: string;
}

/**
 * Desplegable nativo. El tema declara `color-scheme`, así que el menú del
 * sistema se abre en claro u oscuro según corresponda.
 */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint
}: {
  readonly label: string;
  readonly value: T;
  readonly options: ReadonlyArray<Option<T>>;
  readonly onChange: (value: T) => void;
  readonly hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => <InlineSelect id={id} value={value} options={options} onChange={onChange} />}
    </Field>
  );
}

export function InlineSelect<T extends string>({
  id,
  value,
  options,
  onChange,
  ariaLabel
}: {
  readonly id?: string;
  readonly value: T;
  readonly options: ReadonlyArray<Option<T>>;
  readonly onChange: (value: T) => void;
  readonly ariaLabel?: string;
}) {
  return (
    <select
      id={id}
      className="kit-select nodrag"
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value as T)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** Variables que el usuario puede escribir entre llaves. */
export function VariableHint({ variables }: { readonly variables: ReadonlyArray<string> }) {
  return (
    <p className="kit-hint kit-variables">
      Puedes usar variables:{" "}
      {variables.map((variable) => (
        <code key={variable} className="kit-variable">
          {variable}
        </code>
      ))}
    </p>
  );
}

/** Botón «añadir» de una lista. */
export function AddButton({ label, onClick, disabled }: { readonly label: string; readonly onClick: () => void; readonly disabled?: boolean }) {
  return (
    <button type="button" className="kit-add nodrag" onClick={onClick} disabled={disabled}>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <path d="M8 3.75v8.5M3.75 8h8.5" />
      </svg>
      {label}
    </button>
  );
}

/** Botón de quitar una fila, con nombre accesible propio. */
export function RemoveButton({ label, onClick }: { readonly label: string; readonly onClick: () => void }) {
  return (
    <button type="button" className="kit-remove nodrag" aria-label={label} title={label} onClick={onClick}>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
      </svg>
    </button>
  );
}

/** Tarjeta de una fila de lista (regla, opción, cabecera…). */
export function ListCard({
  title,
  onRemove,
  removeLabel,
  children
}: {
  readonly title: string;
  readonly onRemove: () => void;
  readonly removeLabel: string;
  readonly children: ReactNode;
}) {
  return (
    <li className="kit-card">
      <div className="kit-card__head">
        <span className="kit-card__title">{title}</span>
        <RemoveButton label={removeLabel} onClick={onRemove} />
      </div>
      <div className="kit-card__body">{children}</div>
    </li>
  );
}

/** Lista de valores cortos escritos como etiquetas (Enter o coma para añadir). */
/** Valor ofrecido para un `ChipsField`, con su color si lo tiene. */
export interface ChipSuggestion {
  readonly value: string;
  readonly color?: string;
}

const MAX_SUGGESTIONS = 8;

const sameValue = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

export function ChipsField({
  label,
  values,
  onChange,
  placeholder,
  hint,
  suggestions = []
}: {
  readonly label: string;
  readonly values: ReadonlyArray<string>;
  readonly onChange: (values: string[]) => void;
  readonly placeholder?: string;
  readonly hint?: string;
  /** Valores que se ofrecen para elegir con un clic. Escribir otros sigue valiendo. */
  readonly suggestions?: ReadonlyArray<ChipSuggestion>;
}) {
  const [text, setText] = useState("");

  const add = (raw: string) => {
    const value = raw.trim().replace(/,$/, "").trim();
    setText("");
    if (value.length === 0 || values.some((existing) => sameValue(existing, value))) return;
    // Si coincide con una sugerencia, se usa su escritura exacta.
    const known = suggestions.find((suggestion) => sameValue(suggestion.value, value));
    onChange([...values, known?.value ?? value]);
  };

  const colorOf = (value: string) => suggestions.find((suggestion) => sameValue(suggestion.value, value))?.color;
  const query = text.trim().toLocaleLowerCase();
  const offered = suggestions
    .filter((suggestion) => !values.some((value) => sameValue(value, suggestion.value)))
    .filter((suggestion) => query === "" || suggestion.value.toLocaleLowerCase().includes(query))
    .slice(0, MAX_SUGGESTIONS);

  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <>
          <div className="kit-chips">
            {values.map((value) => {
              const color = colorOf(value);
              return (
                <span
                  key={value}
                  className={color ? "kit-chip kit-chip--colored" : "kit-chip"}
                  style={color ? ({ "--kit-chip-color": color } as CSSProperties) : undefined}
                >
                  {value}
                  <button
                    type="button"
                    className="kit-chip__remove nodrag"
                    aria-label={`Quitar ${value}`}
                    onClick={() => onChange(values.filter((v) => v !== value))}
                  >
                    ×
                  </button>
                </span>
              );
            })}
            <input
              id={id}
              type="text"
              className="kit-chips__input nodrag"
              value={text}
              placeholder={values.length === 0 ? placeholder : ""}
              onChange={(event) => setText(event.target.value)}
              onBlur={() => add(text)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  add(text);
                } else if (event.key === "Backspace" && text === "" && values.length > 0) {
                  onChange(values.slice(0, -1));
                }
              }}
            />
          </div>
          {offered.length > 0 ? (
            <div className="kit-chip-suggestions" role="group" aria-label={`Sugerencias para ${label}`}>
              {offered.map((suggestion) => (
                <button
                  key={suggestion.value}
                  type="button"
                  className="kit-chip-suggestion nodrag"
                  style={suggestion.color ? ({ "--kit-chip-color": suggestion.color } as CSSProperties) : undefined}
                  // mousedown: que el blur del campo no se coma el clic.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => add(suggestion.value)}
                >
                  <span className="kit-chip-suggestion__dot" aria-hidden="true" />
                  {suggestion.value}
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </Field>
  );
}

/** Aviso informativo dentro del editor (no es un error de validación). */
export function Notice({ children }: { readonly children: ReactNode }) {
  return <p className="kit-notice">{children}</p>;
}
