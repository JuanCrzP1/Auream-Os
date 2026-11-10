import { useAccount } from "@shared/account/AccountContext";

/**
 * Correo de acceso: con el que inicias sesión. Es una credencial y su única
 * autoridad es el proveedor de identidad (Neon Auth), que hoy no deja a cada
 * persona cambiarlo (verificado: responde `CHANGE_EMAIL_DISABLED`). Por eso se
 * muestra sin editar y se explica cómo cambiarlo.
 */
export function EmailSection() {
  const { email } = useAccount();
  return (
    <section className="account-section" aria-labelledby="account-email-title">
      <div className="account-section__head">
        <h2 className="account-section__title" id="account-email-title">Correo de acceso</h2>
        <p className="account-section__subtitle">Con este correo inicias sesión y recibes los avisos de tu cuenta.</p>
      </div>
      <div className="account-email">
        <span className="account-email__value">{email}</span>
        <span className="account-email__badge">Acceso</span>
      </div>
      <p className="account-section__note">
        Por seguridad, el correo de acceso no se cambia desde aquí. Si necesitas usar otro, escríbenos a soporte y lo cambiamos contigo.
      </p>
    </section>
  );
}
