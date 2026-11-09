// ---------------------------------------------------------------------------
// El último envío recibido, como árbol (como en Leona): cada dato simple es un
// botón; al hacer clic se usa su ruta (`data.buyer.phone`, `items.0.name`) en
// el campo del mapeo que esté elegido. Muestra hasta 6 niveles y los primeros
// 5 elementos de cada lista.
// ---------------------------------------------------------------------------

const MAX_DEPTH = 6;
const MAX_ITEMS = 5;

function preview(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return `"${value.length > 60 ? `${value.slice(0, 60)}…` : value}"`;
  return String(value);
}

function Node({ name, value, path, depth, onPick }: { readonly name: string; readonly value: unknown; readonly path: string; readonly depth: number; readonly onPick: (path: string) => void }) {
  if (value !== null && typeof value === "object") {
    const entries = Array.isArray(value) ? value.slice(0, MAX_ITEMS).map((item, index) => [String(index), item] as const) : Object.entries(value);
    const hidden = Array.isArray(value) ? value.length - entries.length : 0;
    return (
      <li>
        <span className="payload-tree__branch">{name}</span>
        {depth >= MAX_DEPTH ? (
          <span className="payload-tree__more"> …</span>
        ) : (
          <ul>
            {entries.map(([key, item]) => (
              <Node key={key} name={key} value={item} path={path ? `${path}.${key}` : key} depth={depth + 1} onPick={onPick} />
            ))}
            {hidden > 0 ? <li className="payload-tree__more">y {hidden} más</li> : null}
          </ul>
        )}
      </li>
    );
  }
  return (
    <li>
      <button type="button" className="payload-tree__leaf" onClick={() => onPick(path)} title={`Usar ${path}`}>
        <span className="payload-tree__key">{name}</span>
        <span className="payload-tree__value">{preview(value)}</span>
      </button>
    </li>
  );
}

export function PayloadTree({ sample, onPick }: { readonly sample: unknown; readonly onPick: (path: string) => void }) {
  if (sample === null || typeof sample !== "object") return null;
  const entries = Array.isArray(sample) ? sample.slice(0, MAX_ITEMS).map((item, index) => [String(index), item] as const) : Object.entries(sample);
  return (
    <ul className="payload-tree" aria-label="Datos del envío de ejemplo">
      {entries.map(([key, value]) => (
        <Node key={key} name={key} value={value} path={key} depth={1} onPick={onPick} />
      ))}
    </ul>
  );
}
