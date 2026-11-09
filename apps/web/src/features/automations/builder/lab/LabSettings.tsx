import { useState } from "react";
import type { SimulationOptions, SimulationPersona } from "@contracts/SimulationContracts";
import { SwitchField } from "../tools/_kit/Switch";

/**
 * Ajustes de la prueba: qué se hace de verdad (IA, integraciones) y quién es
 * el cliente de prueba. El Pixel y WhatsApp nunca salen en una prueba.
 */
export function LabSettings({
  options,
  persona,
  onOptions,
  onPersona,
  onClose
}: {
  readonly options: SimulationOptions;
  readonly persona: SimulationPersona;
  readonly onOptions: (next: SimulationOptions) => void;
  readonly onPersona: (next: SimulationPersona) => void;
  readonly onClose: () => void;
}) {
  const [name, setName] = useState(persona.name);
  const [phone, setPhone] = useState(persona.phone);
  const save = () => {
    const digits = phone.replace(/\D/g, "");
    onPersona({ ...persona, name: name.trim() || persona.name, phone: digits.length >= 7 && digits.length <= 15 ? digits : persona.phone });
    onClose();
  };

  return (
    <div className="lab-settings" role="dialog" aria-label="Ajustes de la prueba">
      <p className="lab-settings__title">Qué se hace de verdad</p>
      <SwitchField label="Usar IA real" hint="La «Extensión IA» responde con tu conexión de IA (gasta tokens)." checked={options.realAi} onChange={(realAi) => onOptions({ ...options, realAi })} />
      <SwitchField
        label="Integraciones reales"
        hint="La «Integración» hace la petición de verdad. Apagado: responde 200 sin llamar."
        checked={options.realIntegrations}
        onChange={(realIntegrations) => onOptions({ ...options, realIntegrations })}
      />
      <p className="lab-settings__note">WhatsApp y el Pixel de Meta nunca se envían en una prueba.</p>

      <p className="lab-settings__title">Cliente de prueba</p>
      <label className="ui-field">
        <span>Nombre</span>
        <input className="ui-input" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="ui-field">
        <span>Teléfono (con indicativo)</span>
        <input className="ui-input" value={phone} inputMode="tel" maxLength={18} onChange={(event) => setPhone(event.target.value)} />
      </label>
      <div className="lab-settings__actions">
        <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="ui-btn ui-btn--primary" onClick={save}>Guardar</button>
      </div>
    </div>
  );
}
