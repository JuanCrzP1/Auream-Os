import { useEffect, useState } from "react";
import type { SupportSettings } from "@contracts/HelpContracts";
import { helpApi } from "@shared/help/helpApi";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";

const EMPTY: SupportSettings = { whatsapp: null, email: null, hours: null, responseTime: null };

/** Cómo contactar a soporte: lo que ven todas las cuentas en el banner y en el panel «?». */
export function SupportSettingsForm() {
  const [settings, setSettings] = useState<SupportSettings>(EMPTY);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    void helpApi.support().then((data) => setSettings(data.settings)).catch(() => undefined);
  }, []);
  const field = (key: keyof SupportSettings, label: string, placeholder: string) => (
    <label className="ui-field"><span>{label}</span><input className="ui-input" value={settings[key] ?? ""} placeholder={placeholder} onChange={(e) => setSettings({ ...settings, [key]: e.target.value || null })} /></label>
  );
  const save = async () => {
    try {
      setSettings(await helpApi.saveSettings(settings));
      setNotice("Guardado. Ya lo ven todas las cuentas.");
    } catch (error) {
      setNotice(apiErrorMessage(error, "No se pudo guardar."));
    }
  };
  return (
    <section className="help-admin__form help-admin__contact" aria-label="Datos de contacto">
      <h2>Datos de contacto de soporte</h2>
      {field("whatsapp", "WhatsApp de soporte (con código de país)", "573001234567")}
      {field("email", "Correo de soporte", "soporte@tuempresa.com")}
      {field("hours", "Horario", "Lunes a viernes, 8 a. m. a 6 p. m. (hora Colombia)")}
      {field("responseTime", "Tiempo de respuesta que prometes", "menos de 2 horas")}
      {notice ? <p className="ui-muted" role="status">{notice}</p> : null}
      <button type="button" className="ui-btn ui-btn--primary" onClick={() => void save()}>Guardar</button>
    </section>
  );
}
