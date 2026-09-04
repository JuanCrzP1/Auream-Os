import type { MessageIntervalItem, MessageIntervalUnit } from "../types";
import { MESSAGE_INTERVAL_UNITS } from "../messageItems";

interface IntervalItemEditorProps {
  readonly item: MessageIntervalItem;
  readonly position: number;
  readonly onEdit: (change: { amount: number } | { unit: MessageIntervalUnit }) => void;
}

/** Atajos: las pausas que se eligen casi siempre, a un clic. */
const RAPIDOS: ReadonlyArray<{ amount: number; unit: MessageIntervalUnit; label: string }> = [
  { amount: 3, unit: "seconds", label: "3s" },
  { amount: 10, unit: "seconds", label: "10s" },
  { amount: 30, unit: "seconds", label: "30s" },
  { amount: 1, unit: "minutes", label: "1min" }
];

/**
 * Cuerpo de una pausa entre bloques.
 *
 * Misma estructura que el resto —rótulo, control, opciones— para que Intervalo
 * no se lea como un bloque de segunda. Lo que cambia es el acento, que hereda
 * del bloque, y el control, que aquí es una duración.
 *
 * Guarda la duración; no la ejecuta. Cómo se traduce una pausa dentro de la
 * secuencia a comportamiento del motor se decidirá al construir la herramienta
 * Intervalo del lienzo, que es otra cosa —esa suspende la sesión entera— y no
 * debe resolverse de refilón aquí. El dato queda bien modelado para entonces.
 */
export function IntervalItemEditor({ item, position, onEdit }: IntervalItemEditorProps) {
  const activo = (amount: number, unit: MessageIntervalUnit) =>
    item.amount === amount && item.unit === unit;

  return (
    <div className="message-item__body">
      <p className="message-item__caption-label">Pausa antes del siguiente bloque</p>

      <div className="message-interval">
        <input
          type="number"
          min={1}
          className="message-interval__amount nodrag"
          value={item.amount}
          onChange={(event) => {
            const valor = Number(event.target.value);
            // Se acota en la entrada: una pausa de cero o negativa no significa
            // nada, y dejar que se guarde obligaría a limpiarla más adelante.
            onEdit({ amount: Number.isFinite(valor) && valor > 0 ? valor : 1 });
          }}
          aria-label={`Duración de la pausa del bloque ${position}`}
        />

        <select
          className="message-interval__unit nodrag"
          value={item.unit}
          onChange={(event) => onEdit({ unit: event.target.value as MessageIntervalUnit })}
          aria-label={`Unidad de la pausa del bloque ${position}`}
        >
          {MESSAGE_INTERVAL_UNITS.map((unidad) => (
            <option key={unidad.value} value={unidad.value}>
              {unidad.label}
            </option>
          ))}
        </select>
      </div>

      {/* Los valores que se eligen casi siempre, sin pasar por el teclado. */}
      <div className="message-interval__presets">
        {RAPIDOS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={`message-interval__preset nodrag${
              activo(preset.amount, preset.unit) ? " message-interval__preset--active" : ""
            }`}
            aria-pressed={activo(preset.amount, preset.unit)}
            onClick={() => {
              onEdit({ amount: preset.amount });
              onEdit({ unit: preset.unit });
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
