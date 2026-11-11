import type { SupportSettings } from "@contracts/HelpContracts";
import { whatsappLink } from "@shared/help/moduleForPath";

/** «¿No encontraste lo que buscabas?»: escribirle al equipo por WhatsApp o correo. Solo aparece si el equipo dejó cómo contactarlo. */
export function SupportBanner({ settings }: { readonly settings: SupportSettings }) {
  if (!settings.whatsapp && !settings.email) return null;
  const promise = [settings.responseTime ? `Respondemos en ${settings.responseTime}` : null, settings.hours].filter(Boolean).join(" · ");
  return (
    <section className="help-support" aria-label="Contactar a soporte">
      <div className="help-support__text">
        <span className="help-support__online"><span aria-hidden="true" />Soporte</span>
        <h2>¿No encontraste lo que buscabas?</h2>
        <p>Escríbele al equipo de Auream.{promise ? ` ${promise}.` : ""}</p>
      </div>
      <div className="help-support__actions">
        {settings.whatsapp ? <a className="help-support__primary" href={whatsappLink(settings.whatsapp, "Ayuda")} target="_blank" rel="noreferrer"><strong>WhatsApp</strong><span>Lo más rápido</span></a> : null}
        {settings.email ? <a className="help-support__option" href={`mailto:${settings.email}`}><strong>Correo</strong><span>{settings.email}</span></a> : null}
      </div>
    </section>
  );
}
