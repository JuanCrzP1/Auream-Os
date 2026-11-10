import { useEffect, useState, type FormEvent } from "react";
import type { CompanyResponse } from "@contracts/AccountContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { updateCompany } from "@shared/account/accountApi";
import { useAccount } from "@shared/account/AccountContext";
import { TimezoneSelect } from "./TimezoneSelect";
import { timeIn } from "../timezones";

/**
 * Datos de la empresa: el nombre que ve tu equipo y la zona horaria con la que
 * corren el Programador, los horarios y las fechas de tus flujos.
 */
export function CompanyForm({ company }: { readonly company: CompanyResponse }) {
  const { setCompany } = useAccount();
  const [name, setName] = useState(company.name);
  const [timezone, setTimezone] = useState(company.timezone);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ readonly kind: "ok" | "error"; readonly text: string } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const readOnly = !company.canEdit;

  useEffect(() => {
    setName(company.name);
    setTimezone(company.timezone);
  }, [company]);

  // La hora de la zona elegida, al minuto: para comprobar que es la del negocio.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      setCompany(await updateCompany({ name, timezone }));
      setMessage({ kind: "ok", text: "Datos de la empresa guardados." });
    } catch (e) {
      setMessage({ kind: "error", text: apiErrorMessage(e, "No se pudieron guardar los datos de la empresa.") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="account-section" onSubmit={(event) => void save(event)}>
      <div className="account-section__head">
        <h2 className="account-section__title">Datos de la empresa</h2>
        <p className="account-section__subtitle">El nombre que ve tu equipo y la hora con la que trabajan tus flujos.</p>
      </div>
      <div className="account-section__grid">
        <label className="ui-field">
          <span>Nombre de la empresa</span>
          <input className="ui-input" value={name} maxLength={80} required disabled={readOnly} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="ui-field">
          <span>Zona horaria</span>
          <TimezoneSelect value={timezone} disabled={readOnly} onChange={setTimezone} />
          <span className="account-section__note">
            La usan el Programador, los horarios y las fechas de tus flujos
            {company.timezoneIsDefault && timezone === company.timezone ? " (ahora rige la de la plataforma: elige la de tu negocio)" : ""}. Allá son las {timeIn(timezone, now)}
          </span>
        </div>
      </div>
      {readOnly ? (
        <p className="account-readonly">Solo el dueño de la cuenta puede cambiar estos datos.</p>
      ) : (
        <div className="account-section__footer">
          {message ? (
            <span className={message.kind === "ok" ? "account-section__ok" : "ui-error"} role={message.kind === "ok" ? "status" : "alert"}>
              {message.text}
            </span>
          ) : null}
          <button type="submit" className="ui-btn ui-btn--primary" disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      )}
    </form>
  );
}
