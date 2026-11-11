import "./broadcast-illustration.css";

const STEPS: ReadonlyArray<readonly [string, number, boolean]> = [["Enviados", 100, false], ["Leídos", 68, false], ["Respondieron", 32, false], ["Compraron", 14, true]];

/** Cómo funciona, sin datos: el mensaje sale con ritmo seguro y se mide hasta la venta. */
export function BroadcastIllustration() {
  return (
    <div className="bc-ill">
      <div className="bc-ill__head">
        <span>🛡 Ritmo seguro</span>
        <small>pausas al azar · horario · tope diario</small>
      </div>
      <div className="bc-ill__funnel">
        {STEPS.map(([label, width, sold]) => (
          <div key={label} className="bc-ill__row">
            <span>{label}</span>
            <i><b className={sold ? "bc-ill__sold" : undefined} style={{ width: `${width}%` }} /></i>
          </div>
        ))}
      </div>
    </div>
  );
}
