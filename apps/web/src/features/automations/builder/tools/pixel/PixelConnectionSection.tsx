import type { ToolResources } from "../ToolResources";
import { Notice, SelectField, type Option } from "../_kit/fields";

// ---------------------------------------------------------------------------
// Paso 1 del Pixel: QUÉ píxel de la cuenta recibe el evento. Como en Leona, el
// bloque solo elige: los píxeles se conectan y administran en Meta Ads (un solo
// lugar para los tokens). Meta Ads abre en otra pestaña, y al volver al editor
// la lista se pone al día sola (`BuilderResourcesProvider`).
// ---------------------------------------------------------------------------

/** Donde viven los píxeles de la cuenta. */
const PIXELS_PAGE = "/meta-ads?tab=pixel";

function MetaAdsLink({ children, className = "pixel-connect__link" }: { readonly children: string; readonly className?: string }) {
  return (
    <a className={`${className} nodrag`} href={PIXELS_PAGE} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

/** Sin píxeles todavía: a Meta Ads a conectar el primero. */
function NoPixels() {
  return (
    <div className="pixel-connect__empty">
      <p className="pixel-connect__empty-title">Todavía no tienes píxeles conectados</p>
      <p className="kit-hint">Los píxeles se conectan una sola vez en Meta Ads; aquí eliges a cuál avisar.</p>
      <MetaAdsLink className="pixel-connect__go">Conectar un píxel en Meta Ads</MetaAdsLink>
      <p className="kit-hint">Cuando lo conectes, vuelve aquí: aparece solo en la lista.</p>
    </div>
  );
}

export function PixelConnectionSection({
  connectionId,
  resources,
  onChange
}: {
  readonly connectionId: string;
  readonly resources: ToolResources | undefined;
  readonly onChange: (connectionId: string) => void;
}) {
  const connections = resources?.pixelConnections ?? [];
  const status = resources?.pixelConnectionsStatus ?? "ready";
  const selected = connections.find((connection) => connection.id === connectionId);

  if (status === "forbidden") return <Notice>Tu rol no permite usar los píxeles de esta cuenta. Pide acceso a un administrador.</Notice>;
  if (status === "unavailable") return <Notice>Los píxeles no están disponibles en este servidor (falta configurar el cifrado de secretos).</Notice>;
  if (status === "loading") return <p className="kit-hint">Cargando tus píxeles…</p>;
  if (status === "error") return <Notice>No pudimos cargar tus píxeles. Revisa tu conexión: la lista se vuelve a pedir al regresar a esta pestaña.</Notice>;
  if (connections.length === 0) return <NoPixels />;

  const options: ReadonlyArray<Option<string>> = [
    ...(selected ? [] : [{ value: "", label: connectionId ? "El píxel elegido ya no existe" : "Elige un píxel…" }]),
    ...connections.map((connection) => ({
      value: connection.id,
      label: `${connection.name} · ${connection.pixelId}${connection.status === "invalid" ? " — token rechazado" : ""}`
    }))
  ];

  return (
    <>
      <SelectField label="Píxel" value={selected ? selected.id : ""} options={options} onChange={(id) => id && onChange(id)} />
      {selected?.status === "invalid" ? <Notice>Meta ya no acepta el token de este píxel. Cámbialo en Meta Ads o elige otro.</Notice> : null}
      <div className="pixel-connect__links">
        <MetaAdsLink>Administrar píxeles en Meta Ads</MetaAdsLink>
      </div>
    </>
  );
}
