import "./connect-meta-invite.css";
import { Link } from "react-router-dom";

/** Sin Meta conectado: lo que trae conectarlo (para quien puede ver los anuncios). */
export function ConnectMetaInvite() {
  return (
    <section className="connect-meta" aria-labelledby="connect-meta-title">
      <div>
        <span className="connect-meta__kicker">Con Meta Ads</span>
        <h2 id="connect-meta-title">Cuánto te cuesta cada venta, y cuánto te deja</h2>
        <p>Conecta tus campañas y aquí verás el ROAS real (con las ventas de WhatsApp que Meta no ve), la ganancia, el costo por venta y qué hacer con cada campaña.</p>
      </div>
      <Link to="/meta-ads?tab=accounts" className="connect-meta__button">Conectar Meta Ads</Link>
    </section>
  );
}
