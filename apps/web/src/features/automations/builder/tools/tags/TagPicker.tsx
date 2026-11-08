import "./tag-picker.css";
import { useId, useState, type CSSProperties } from "react";
import { LABEL_COLORS } from "@contracts/ContactContracts";
import type { ToolCapabilities, ToolLabelOption } from "../ToolResources";

// ---------------------------------------------------------------------------
// Selector de etiquetas del bloque: la LISTA de etiquetas de la cuenta, cada
// una con su color, para marcar o desmarcar (como el catálogo de Leona). Si se
// escribe una que no existe, «Crear» la guarda en el catálogo y la marca.
//
// El bloque guarda NOMBRES (es el contrato con el motor); el catálogo pone el
// color y la escritura exacta.
// ---------------------------------------------------------------------------

const same = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

const dot = (color: string) => ({ "--tag-color": color }) as CSSProperties;

/** Color para una etiqueta nueva: el primero de la paleta que aún no se usa. */
function nextColor(catalog: ReadonlyArray<ToolLabelOption>): string {
  return LABEL_COLORS.slice(1).find((color) => !catalog.some((label) => label.color === color)) ?? LABEL_COLORS[catalog.length % LABEL_COLORS.length]!;
}

export function TagPicker({
  label,
  catalog,
  selected,
  allowCreate,
  createLabel,
  onChange
}: {
  readonly label: string;
  readonly catalog: ReadonlyArray<ToolLabelOption>;
  readonly selected: ReadonlyArray<string>;
  /** Al quitar no tiene sentido crear: solo se quita lo que existe. */
  readonly allowCreate: boolean;
  readonly createLabel: ToolCapabilities["createLabel"];
  readonly onChange: (tags: string[]) => void;
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelected = (name: string) => selected.some((tag) => same(tag, name));
  const toggle = (name: string) => onChange(isSelected(name) ? selected.filter((tag) => !same(tag, name)) : [...selected, name]);
  const colorOf = (name: string) => catalog.find((item) => same(item.name, name))?.color;

  const text = query.trim();
  const visible = text ? catalog.filter((item) => item.name.toLocaleLowerCase().includes(text.toLocaleLowerCase())) : catalog;
  const exact = catalog.find((item) => same(item.name, text));
  const canCreate = allowCreate && text.length > 0 && !exact && text.length <= 40;
  const newColor = nextColor(catalog);

  const create = async () => {
    if (!canCreate || creating) return;
    setError(null);
    if (!createLabel) {
      // Fuera del builder: se guarda el nombre y el motor la crea al usarse.
      onChange([...selected, text]);
      setQuery("");
      return;
    }
    setCreating(true);
    const outcome = await createLabel({ name: text, color: newColor });
    setCreating(false);
    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }
    if (!isSelected(outcome.label.name)) onChange([...selected, outcome.label.name]);
    setQuery("");
  };

  return (
    <div className="tag-picker">
      <div className="tag-picker__selected" aria-live="polite">
        {selected.length === 0 ? (
          <span className="tag-picker__none">Ninguna etiqueta elegida</span>
        ) : (
          selected.map((tag) => {
            const color = colorOf(tag);
            return (
              <span
                key={tag}
                className={`tag-picker__chip${color ? "" : " tag-picker__chip--pending"}`}
                style={dot(color ?? "var(--muted)")}
                title={color ? undefined : "No está en tu catálogo: se creará al usarse"}
              >
                <span className="tag-picker__dot" aria-hidden="true" />
                {tag}
                <button type="button" className="tag-picker__chip-remove nodrag" aria-label={`Quitar ${tag}`} onClick={() => toggle(tag)}>
                  ×
                </button>
              </span>
            );
          })
        )}
      </div>

      <div className="tag-picker__box">
        <label htmlFor={searchId} className="tag-picker__sr">
          {label}
        </label>
        <div className="tag-picker__search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-4.2-4.2" />
          </svg>
          <input
            id={searchId}
            type="text"
            className="tag-picker__input nodrag"
            value={query}
            placeholder={allowCreate ? "Buscar o crear etiqueta…" : "Buscar etiqueta…"}
            autoComplete="off"
            spellCheck={false}
            maxLength={40}
            onChange={(event) => {
              setQuery(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (exact) {
                if (!isSelected(exact.name)) toggle(exact.name);
                setQuery("");
              } else void create();
            }}
          />
        </div>

        <ul className="tag-picker__list nowheel" aria-label="Etiquetas de la cuenta">
          {visible.map((item) => {
            const checked = isSelected(item.name);
            return (
              <li key={item.name}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  className={`tag-picker__option nodrag${checked ? " tag-picker__option--checked" : ""}`}
                  style={dot(item.color)}
                  onClick={() => toggle(item.name)}
                >
                  <span className="tag-picker__dot" aria-hidden="true" />
                  <span className="tag-picker__name">{item.name}</span>
                  <span className="tag-picker__check" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m3.5 8.5 3 3 6-7" />
                    </svg>
                  </span>
                </button>
              </li>
            );
          })}

          {canCreate ? (
            <li>
              <button type="button" className="tag-picker__option tag-picker__option--create nodrag" style={dot(newColor)} disabled={creating} onClick={() => void create()}>
                <span className="tag-picker__plus" aria-hidden="true">
                  +
                </span>
                <span className="tag-picker__name">{creating ? `Creando «${text}»…` : `Crear etiqueta «${text}»`}</span>
                <span className="tag-picker__dot" aria-hidden="true" />
              </button>
            </li>
          ) : null}

          {visible.length === 0 && !canCreate ? (
            <li className="tag-picker__empty">
              {catalog.length === 0
                ? allowCreate
                  ? "Aún no tienes etiquetas. Escribe un nombre para crear la primera."
                  : "Aún no tienes etiquetas en tu cuenta."
                : `No hay etiquetas que coincidan con «${text}».`}
            </li>
          ) : null}
        </ul>
      </div>

      {error ? (
        <p className="tag-picker__error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="kit-hint">Son las mismas etiquetas de Contactos → Etiquetas; ahí puedes cambiar nombres y colores.</p>
    </div>
  );
}
