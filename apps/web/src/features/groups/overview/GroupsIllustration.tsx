import "./groups-illustration.css";

const GROUPS: ReadonlyArray<readonly [number, number, string, "full" | "filling" | "next"]> = [
  [1, 100, "Lleno", "full"],
  [2, 100, "Lleno", "full"],
  [3, 55, "Llenándose", "filling"],
  [4, 0, "Se crea solo", "next"]
];

/** Cómo funciona, sin datos: un enlace y los grupos que se llenan y se crean solos. */
export function GroupsIllustration() {
  return (
    <div className="gr-ill">
      <div className="gr-ill__link">
        <span>🔗 tu-dominio/g/tu-campaña</span>
        <small>1 enlace</small>
      </div>
      <div className="gr-ill__groups">
        {GROUPS.map(([position, fill, label, kind]) => (
          <span key={position} className="gr-ill__group">
            <i className={`gr-ill__bar gr-ill__bar--${kind}`}>{kind === "next" ? "+" : <b style={{ height: `${fill}%` }} />}</i>
            <strong>Grupo {position}</strong>
            <small className={`gr-ill__state gr-ill__state--${kind}`}>{label}</small>
          </span>
        ))}
      </div>
    </div>
  );
}
