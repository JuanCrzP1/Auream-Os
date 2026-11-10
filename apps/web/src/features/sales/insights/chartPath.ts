// La línea y el área de una curva de ventas en un lienzo de `width`×`height`,
// con un margen arriba para que el punto más alto no toque el borde.
//
// La curva es MONÓTONA (Fritsch–Carlson): suave, pero nunca inventa picos ni
// baja de cero entre dos días; entre dos puntos iguales queda plana.

export interface ChartGeometry {
  readonly line: string;
  readonly area: string;
  /** Posición de cada punto (para marcar el mejor día). */
  readonly points: ReadonlyArray<{ readonly x: number; readonly y: number }>;
}

const r = (value: number) => Math.round(value * 10) / 10;

/** Pendientes de cada punto que mantienen la curva monótona entre vecinos. */
function slopes(points: ReadonlyArray<{ x: number; y: number }>): number[] {
  const n = points.length;
  const secants = points.slice(0, -1).map((point, i) => (points[i + 1]!.y - point.y) / (points[i + 1]!.x - point.x || 1));
  const m = points.map((_, i) => (i === 0 ? secants[0]! : i === n - 1 ? secants[n - 2]! : secants[i - 1]! * secants[i]! <= 0 ? 0 : (secants[i - 1]! + secants[i]!) / 2));
  for (let i = 0; i < n - 1; i += 1) {
    if (secants[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i]! / secants[i]!;
    const b = m[i + 1]! / secants[i]!;
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * secants[i]!;
      m[i + 1] = t * b * secants[i]!;
    }
  }
  return m;
}

export function chartPath(values: ReadonlyArray<number>, width: number, height: number, padTop = 14): ChartGeometry {
  if (values.length === 0) return { line: "", area: "", points: [] };
  const max = Math.max(...values, 0);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values.map((value, index) => ({ x: r(index * step), y: r(max > 0 ? height - (value / max) * (height - padTop) : height - 2) }));
  if (points.length === 1) return { line: `M0,${points[0]!.y} L${width},${points[0]!.y}`, area: `M0,${points[0]!.y} L${width},${points[0]!.y} L${width},${height} L0,${height} Z`, points };

  const m = slopes(points);
  let line = `M${points[0]!.x},${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dx = (b.x - a.x) / 3;
    line += ` C${r(a.x + dx)},${r(a.y + m[i]! * dx)} ${r(b.x - dx)},${r(b.y - m[i + 1]! * dx)} ${b.x},${b.y}`;
  }
  const last = points[points.length - 1]!;
  return { line, area: `${line} L${last.x},${height} L0,${height} Z`, points };
}
