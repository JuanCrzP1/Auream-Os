import "./first-broadcast.css";
import "./first-broadcast-phone.css";
import "./first-broadcast-parts.css";
import "./first-broadcast-how.css";

const STEPS: ReadonlyArray<readonly [string, string]> = [
  ["Qué enviar", "Un flujo o un mensaje, en 1 a 3 versiones"],
  ["A quién", "Filtros y audiencias guardadas"],
  ["Número y cuándo", "Ahora o programada, con ritmo seguro"],
  ["Enviar y medir", "Del envío a la venta, en vivo"]
];
const PACE = [40, 75, 30, 90, 55, 20, 65];
const FUNNEL: ReadonlyArray<readonly [string, number]> = [["Enviados", 100], ["Leídos", 61], ["Respondieron", 22], ["Compraron", 8]];

/**
 * Difusiones sin ninguna todavía: vende la idea (a quien ya escribió, ritmo
 * seguro, lo que vendió), cuenta cómo funciona y muestra cómo se verá el
 * resultado. Todo lo de aquí es un ejemplo.
 */
export function FirstBroadcast({ canManage, onNew }: { readonly canManage: boolean; readonly onNew: () => void }) {
  return (
    <div className="bc-first">
      <section className="bc-first__hero" aria-label="Tu primera difusión">
        <span className="bc-first__glow" aria-hidden="true" />
        <div className="bc-first__pitch">
          <span className="bc-first__pill">Nuevo · Difusiones</span>
          <h2>Escríbele a todos tus clientes <span>sin quemar tu número</span></h2>
          <p>Un flujo o un mensaje con foto a quien ya te escribió, con pausas al azar y tope por día. Y al final, cuánto te vendió.</p>
          <div className="bc-first__cta">
            {canManage ? (
              <button type="button" className="bc-first__button" onClick={onNew}>Crear la primera difusión →</button>
            ) : (
              <span className="bc-first__note">Las difusiones las crean los dueños y administradores.</span>
            )}
            {canManage ? <span className="bc-first__note">Tarda 2 minutos · puedes enviarte una prueba antes</span> : null}
          </div>
        </div>
        <div className="bc-first__visual" aria-hidden="true">
          <div className="bc-first__phone">
            <div className="bc-first__phone-top"><span /> <strong>Tu negocio</strong></div>
            <div className="bc-first__bubble">
              <span className="bc-first__photo">−30 % solo hoy</span>
              <span>Hola Laura 👋 ¿te muestro las canciones de esta semana?</span>
              <small>10:02 ✓✓</small>
            </div>
            <div className="bc-first__reply">¡Sí! Quiero una 😍</div>
          </div>
          <div className="bc-first__float bc-first__float--money">
            <small>Ejemplo de resultado</small>
            <strong>$ 449.100</strong>
            <span>9 compraron · 84 respondieron</span>
          </div>
          <div className="bc-first__float bc-first__float--safe">🛡 Número sano · 0 bloqueos</div>
        </div>
      </section>

      <section className="bc-first__features" aria-label="Lo que hace">
        <article className="bc-first__card">
          <span className="bc-first__icon">🎯</span>
          <strong>A quien ya te escribió</strong>
          <p>Filtra por etiquetas, etapa del CRM, país y días. Ves a cuántos les llega mientras eliges.</p>
          <div className="bc-first__chips" aria-hidden="true">
            <span className="bc-first__chip bc-first__chip--on">✓ Interesado</span>
            <span className="bc-first__chip bc-first__chip--on">✓ 🇨🇴 Colombia</span>
            <span className="bc-first__chip">60 días</span>
            <span className="bc-first__chip bc-first__chip--dark">1.248 personas</span>
          </div>
        </article>
        <article className="bc-first__card bc-first__card--safe">
          <span className="bc-first__icon">🛡</span>
          <strong>A un ritmo seguro</strong>
          <p>Pausas al azar, solo en tu horario, tope por día y un número nuevo que calienta de a poco.</p>
          <div className="bc-first__pace" aria-hidden="true">
            {PACE.map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}
          </div>
          <span className="bc-first__warm">Calentando · día 2 de 7</span>
        </article>
        <article className="bc-first__card">
          <span className="bc-first__icon">💰</span>
          <strong>Con lo que vendió</strong>
          <p>Quién leyó, quién respondió y quién compró en los 3 días siguientes. Y el segundo envío a los que no respondieron.</p>
          <div className="bc-first__funnel" aria-hidden="true">
            {FUNNEL.map(([label, width]) => (
              <div key={label} className={label === "Compraron" ? "bc-first__funnel--sold" : undefined}>
                <span>{label}</span>
                <i style={{ width: `${width}%` }} />
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="bc-first__how" aria-label="Cómo funciona">
        <strong>Cómo funciona</strong>
        <ol>
          {STEPS.map(([title, text], index) => (
            <li key={title}>
              <span className={index === STEPS.length - 1 ? "bc-first__num bc-first__num--last" : "bc-first__num"}>{index + 1}</span>
              <span><strong>{title}</strong>{text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="bc-first__sample" aria-label="Así se verá">
        <span className="bc-first__sample-tag">Así se verá</span>
        <div className="bc-first__sample-row" aria-hidden="true">
          <span><strong>Promo Día de la Madre</strong><small>Flujo «Oferta mamá» · Ventas 1</small></span>
          <span className="bc-first__sample-state"><em>Terminada</em><i /></span>
          <span><strong>826</strong><small>enviados</small></span>
          <span><strong>61 %</strong><small>leyeron</small></span>
          <span><strong>84</strong><small>respondieron</small></span>
          <span><strong>9</strong><small>compraron</small></span>
          <span className="bc-first__sample-money"><strong>$ 449.100</strong><small>vendido</small></span>
        </div>
      </section>
    </div>
  );
}
