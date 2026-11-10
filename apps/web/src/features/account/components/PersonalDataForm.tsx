import { useEffect, useState, type FormEvent } from "react";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { CountryDialPicker } from "@shared/ui/country-dial/CountryDialPicker";
import { updateMyProfile } from "@shared/account/accountApi";
import { useAccount } from "@shared/account/AccountContext";
import { joinPhone, splitPhone } from "../phone";

/**
 * Datos personales: el nombre con el que te ve tu equipo y tu WhatsApp
 * personal (no se usa en los flujos). Se guardan en tu perfil.
 */
export function PersonalDataForm() {
  const { profile, displayName, setProfile } = useAccount();
  const [name, setName] = useState(displayName);
  const [dial, setDial] = useState(() => splitPhone(profile?.phone ?? null).dial);
  const [number, setNumber] = useState(() => splitPhone(profile?.phone ?? null).number);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ readonly kind: "ok" | "error"; readonly text: string } | null>(null);

  // Cuando el perfil termina de cargar, el formulario toma sus datos.
  useEffect(() => {
    setName(displayName);
    const phone = splitPhone(profile?.phone ?? null);
    setDial(phone.dial);
    setNumber(phone.number);
  }, [profile, displayName]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      setProfile(await updateMyProfile({ displayName: name, phone: joinPhone(dial, number) }));
      setMessage({ kind: "ok", text: "Datos guardados." });
    } catch (e) {
      setMessage({ kind: "error", text: apiErrorMessage(e, "No se pudieron guardar tus datos.") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="account-section" onSubmit={(event) => void save(event)}>
      <div className="account-section__head">
        <h2 className="account-section__title">Datos personales</h2>
        <p className="account-section__subtitle">Así te ve tu equipo en Auream.</p>
      </div>
      <div className="account-section__grid">
        <label className="ui-field">
          <span>Nombre completo</span>
          <input className="ui-input" value={name} maxLength={80} autoComplete="name" onChange={(event) => setName(event.target.value)} required />
        </label>
        <div className="ui-field">
          <span id="personal-phone-label">WhatsApp personal</span>
          <div className="account-phone">
            <CountryDialPicker value={dial} onChange={setDial} ariaLabel="Prefijo de tu WhatsApp" />
            <input
              className="ui-input"
              inputMode="tel"
              autoComplete="tel-national"
              aria-labelledby="personal-phone-label"
              placeholder="300 123 4567"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
            />
          </div>
          <span className="account-section__note">Número personal: no se usa en las automatizaciones.</span>
        </div>
      </div>
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
    </form>
  );
}
