import type { SupportSettings } from "@contracts/HelpContracts";
import { whatsappLink } from "@shared/help/moduleForPath";

/** «¿No encontraste lo que buscabas?»: hablar con una persona (WhatsApp, un caso o correo). */
export function SupportBanner({ settings, onCase, compact = false }: { readonly settings: SupportSettings; readonly onCase: () => void; readonly compact?: boolean }) {
  const promise = [settings.responseTime ? `Respondemos en ${settings.responseTime}` : null, settings.hours].filter(Boolean).join(" · ");
  return (
    <section className={`help-support${compact ? " help-support--compact" : ""}`} aria-label="Contactar a soporte">
      <div className="help-support__text">
        <span className="help-support__online"><span aria-hidden="true" />Soporte</span>
        <h2>{compact ? "¿Aún necesitas ayuda?" : "¿No encontraste lo que buscabas?"}</h2>
        <p>Habla con una persona del equipo.{promise ? ` ${promise}.` : ""}</p>
      </div>
      <div className="help-support__actions">
        {settings.whatsapp ? <a className="help-support__primary" href={whatsappLink(settings.whatsapp, "Ayuda")} target="_blank" rel="noreferrer"><strong>WhatsApp</strong><span>Lo más rápido</span></a> : null}
        <button type="button" className="help-support__option" onClick={onCase}><strong>Abrir un caso</strong><span>Con captura y seguimiento</span></button>
        {settings.email ? <a className="help-support__option" href={`mailto:${settings.email}`}><strong>Correo</strong><span>{settings.email}</span></a> : null}
      </div>
    </section>
  );
}
