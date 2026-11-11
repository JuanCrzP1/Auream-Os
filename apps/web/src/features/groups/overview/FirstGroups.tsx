import "./first-groups.css";
import "./first-groups-parts.css";

const FEATURES: ReadonlyArray<readonly [string, string, string]> = [
  ["🔗", "Un enlace que nunca se llena", "Lo pones en tus anuncios, tu bio e historias. Cuando un grupo llega al cupo, Auream crea el siguiente con el mismo nombre, foto y reglas."],
  ["📣", "Un mensaje a todos tus grupos", "Texto, foto, video, audio o encuesta, ahora o programado, y avisa a todos aunque tengan el grupo silenciado."],
  ["💰", "Lo que vende cada grupo", "Del clic a la compra: quién entró, quién se quedó y cuánto vendieron las personas de cada grupo."]
];
const STEPS: ReadonlyArray<readonly [string, string]> = [
  ["Crea la campaña", "Nombre, foto, descripción y cupo"],
  ["Comparte el enlace", "En anuncios, bio, historias o un QR"],
  ["Envía a los grupos", "Lanzamientos, ofertas y encuestas"],
  ["Mira lo que vende", "Cada grupo con su plata"]
];

/** Grupos la primera vez: vende la idea, cuenta cómo funciona y lleva a crear la primera campaña. */
export function FirstGroups({ canManage, hasNumbers, onNew }: { readonly canManage: boolean; readonly hasNumbers: boolean; readonly onNew: () => void }) {
  return (
    <div className="gr-first">
      <section className="gr-first__hero" aria-label="Tu primera campaña de grupos">
        <div className="gr-first__pitch">
          <span className="gr-first__pill">Grupos de WhatsApp que venden</span>
          <h2>Un solo enlace que <span>llena tus grupos</span> solo</h2>
          <p>Para lanzamientos, ofertas y clientes VIP: los grupos se crean solos, la bienvenida sale sola, y ves cuánto vende cada uno.</p>
          {canManage && hasNumbers ? <button type="button" className="gr-first__button" onClick={onNew}>Crear la primera campaña →</button> : null}
          {canManage && !hasNumbers ? <span className="gr-first__note">Primero conecta un número con QR en Conexiones: los grupos se crean por él.</span> : null}
          {!canManage ? <span className="gr-first__note">Las campañas las crean los dueños y administradores.</span> : null}
        </div>
        <div className="gr-first__visual" aria-hidden="true">
          <div className="gr-first__link">
            <small>Tu enlace</small>
            <strong>/g/navidad</strong>
          </div>
          {[["Navidad #1", 100, "Lleno"], ["Navidad #2", 100, "Lleno"], ["Navidad #3", 63, "Recibiendo"], ["Navidad #4", 0, "Se crea solo"]].map(([name, fill, state]) => (
            <div key={name as string} className="gr-first__group">
              <span><strong>{name}</strong><small>{state}</small></span>
              <i><b style={{ width: `${fill}%` }} className={fill === 100 ? "gr-first__full" : undefined} /></i>
            </div>
          ))}
          <div className="gr-first__money"><small>Ejemplo de resultado</small><strong>$ 3.912.000</strong><span>78 compraron · 93 % se quedaron</span></div>
        </div>
      </section>
      <section className="gr-first__features" aria-label="Lo que hace">
        {FEATURES.map(([icon, title, text]) => (
          <article key={title} className="gr-first__card">
            <span className="gr-first__icon" aria-hidden="true">{icon}</span>
            <strong>{title}</strong>
            <p>{text}</p>
          </article>
        ))}
      </section>
      <section className="gr-first__how" aria-label="Cómo funciona">
        <strong>Cómo funciona</strong>
        <ol>
          {STEPS.map(([title, text], index) => (
            <li key={title}><span className={index === 3 ? "gr-first__num gr-first__num--last" : "gr-first__num"}>{index + 1}</span><span><strong>{title}</strong>{text}</span></li>
          ))}
        </ol>
      </section>
    </div>
  );
}
