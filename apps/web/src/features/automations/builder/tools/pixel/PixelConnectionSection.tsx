import { useId, useState } from "react";
import { META_EVENTS_MANAGER_URL } from "@contracts/PixelContracts";
import type { ToolResources } from "../ToolResources";
import { Notice, SelectField, TextField, type Option } from "../_kit/fields";

// ---------------------------------------------------------------------------
// Paso 1 del Pixel: QUÉ píxel de la cuenta recibe el evento. El token no pasa
// por aquí: se elige una conexión (o se crea una sin salir del bloque).
// ---------------------------------------------------------------------------

function ConnectForm({ resources, onConnected, onCancel }: { readonly resources: ToolResources; readonly onConnected: (id: string) => void; readonly onCancel?: () => void }) {
  const tokenId = useId();
  const [name, setName] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cleanId = pixelId.replace(/\D/g, "");

  const connect = async () => {
    if (!resources.createPixelConnection) return;
    setBusy(true);
    setError(null);
    const outcome = await resources.createPixelConnection({ name: name.trim() || `Píxel ${cleanId.slice(-4)}`, pixelId: cleanId, accessToken: token.trim() });
    setBusy(false);
    if (outcome.ok) onConnected(outcome.value.id);
    else setError(outcome.message);
  };

  return (
    <div className="pixel-connect">
      <TextField label="Nombre" value={name} placeholder="Píxel de ventas" onChange={setName} />
      <TextField label="ID del píxel (conjunto de datos)" value={pixelId} monospace placeholder="1234567890123456" onChange={setPixelId} />
      <div className="kit-field">
        <span className="pixel-connect__label-row">
          <label className="kit-label" htmlFor={tokenId}>
            Token de la API de Conversiones
          </label>
          <a className="pixel-connect__link" href={META_EVENTS_MANAGER_URL} target="_blank" rel="noopener noreferrer">
            ¿Dónde lo consigo?
          </a>
        </span>
        <input
          id={tokenId}
          type="password"
          className="kit-input kit-input--mono nodrag"
          value={token}
          placeholder="EAAG…"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setToken(event.target.value)}
        />
        <p className="kit-hint">Se comprueba con Meta y se guarda cifrado en tu cuenta, no en el flujo.</p>
      </div>
      {error ? (
        <p className="pixel-connect__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="pixel-connect__actions">
        {onCancel ? (
          <button type="button" className="pixel-connect__ghost nodrag" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
        ) : null}
        <button type="button" className="pixel-connect__primary nodrag" onClick={() => void connect()} disabled={busy || cleanId.length < 8 || token.trim().length < 30}>
          {busy ? "Verificando con Meta…" : "Conectar píxel"}
        </button>
      </div>
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
  const [connecting, setConnecting] = useState(false);

  if (status === "forbidden") return <Notice>Tu rol no permite usar los píxeles de esta cuenta. Pide acceso a un administrador.</Notice>;
  if (status === "unavailable") return <Notice>Los píxeles no están disponibles en este servidor (falta configurar el cifrado de secretos).</Notice>;

  if (connections.length === 0 || connecting) {
    if (!resources?.createPixelConnection) return <Notice>Conecta un píxel desde Meta Ads para usar este bloque.</Notice>;
    return (
      <>
        {connections.length === 0 ? <p className="kit-hint">Conecta tu píxel una vez; después lo eliges de la lista en cualquier bloque.</p> : null}
        <ConnectForm
          resources={resources}
          {...(connections.length > 0 ? { onCancel: () => setConnecting(false) } : {})}
          onConnected={(id) => {
            setConnecting(false);
            onChange(id);
          }}
        />
      </>
    );
  }

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
        <button type="button" className="pixel-connect__link nodrag" onClick={() => setConnecting(true)}>
          + Conectar otro píxel
        </button>
        <a className="pixel-connect__link" href="/meta-ads?tab=pixel" target="_blank" rel="noopener noreferrer">
          Administrar píxeles
        </a>
      </div>
    </>
  );
}
