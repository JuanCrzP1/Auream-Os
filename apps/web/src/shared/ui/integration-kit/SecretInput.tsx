import "./secret-input.css";
import { useState } from "react";

/** Campo de clave: oculto por defecto, con botón para mostrarla mientras se pega. */
export function SecretInput({
  id,
  value,
  placeholder,
  onChange
}: {
  readonly id: string;
  readonly value: string;
  readonly placeholder: string;
  readonly onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="secret-input">
      <input
        id={id}
        className="ui-input secret-input__field"
        type={visible ? "text" : "password"}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" className="secret-input__toggle" onClick={() => setVisible((v) => !v)} aria-label={visible ? "Ocultar clave" : "Mostrar clave"}>
        {visible ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}
