import { useMemo } from "react";
import { timezoneOptions } from "../timezones";

/**
 * Zona horaria de la empresa: primero las de los países donde opera Auream
 * (con su diferencia con UTC), luego todas las demás.
 */
export function TimezoneSelect({
  value,
  disabled,
  onChange
}: {
  readonly value: string;
  readonly disabled?: boolean;
  readonly onChange: (zone: string) => void;
}) {
  const { common, others } = useMemo(() => timezoneOptions(value), [value]);
  return (
    <select className="ui-input" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} aria-label="Zona horaria">
      <optgroup label="Más usadas">
        {common.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </optgroup>
      {others.length > 0 ? (
        <optgroup label="Todas">
          {others.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} ({option.value})
            </option>
          ))}
        </optgroup>
      ) : null}
    </select>
  );
}
