import "./trend-chip.css";

/** «▲ 18 % frente al periodo anterior»: verde si sube, rojo si baja; nada si no hay con qué comparar. */
export function TrendChip({ change, suffix, compact = false }: { readonly change: number | null; readonly suffix?: string; readonly compact?: boolean }) {
  if (change === null) return null;
  const tone = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const arrow = change > 0 ? "▲" : change < 0 ? "▼" : "＝";
  return (
    <span className={`trend-chip trend-chip--${tone}${compact ? " trend-chip--compact" : ""}`}>
      <span aria-hidden="true">{arrow}</span> {Math.abs(change)} %{suffix ? ` ${suffix}` : ""}
      <span className="trend-chip__sr">{change > 0 ? " más" : change < 0 ? " menos" : " igual"}</span>
    </span>
  );
}
