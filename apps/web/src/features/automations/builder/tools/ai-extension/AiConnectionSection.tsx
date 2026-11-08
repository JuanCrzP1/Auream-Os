import { useEffect, useId, useState } from "react";
import { AI_PROVIDERS, AI_SUGGESTED_MODELS, aiProviderInfo, type AiModelOption, type AiProviderId } from "@contracts/AiContracts";
import type { ToolResources } from "../ToolResources";
import { Notice, SelectField, TextField, type Option } from "../_kit/fields";
import type { AiConfig } from "./aiConfig";

// ---------------------------------------------------------------------------
// Paso 1 del bloque de IA: QUÉ conexión de la cuenta y QUÉ modelo. La clave no
// pasa por aquí: se elige una conexión (o se crea una sin salir del bloque) y
// el modelo sale de la lista real de esa cuenta del proveedor.
// ---------------------------------------------------------------------------

const CUSTOM = "__custom__";

type ModelState =
  | { readonly status: "idle" | "loading" }
  | { readonly status: "ready"; readonly models: ReadonlyArray<AiModelOption> }
  | { readonly status: "fallback"; readonly models: ReadonlyArray<AiModelOption>; readonly message: string };

function ConnectForm({
  resources,
  onConnected,
  onCancel
}: {
  readonly resources: ToolResources;
  readonly onConnected: (credentialId: string) => void;
  readonly onCancel?: () => void;
}) {
  const keyId = useId();
  const [provider, setProvider] = useState<AiProviderId>("openai");
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const info = aiProviderInfo(provider);

  const connect = async () => {
    if (!resources.createAiCredential) return;
    setBusy(true);
    setError(null);
    const outcome = await resources.createAiCredential({ provider, name: name.trim() || info.name, apiKey: apiKey.trim() });
    setBusy(false);
    if (outcome.ok) onConnected(outcome.value.id);
    else setError(outcome.message);
  };

  return (
    <div className="ai-connect">
      <div className="ai-connect__providers" role="radiogroup" aria-label="Proveedor de IA">
        {AI_PROVIDERS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={provider === option.id}
            className={`ai-connect__provider nodrag${provider === option.id ? " ai-connect__provider--on" : ""}`}
            onClick={() => setProvider(option.id)}
          >
            {option.name}
          </button>
        ))}
      </div>
      <TextField label="Nombre de la conexión" value={name} placeholder={`${info.name} principal`} onChange={setName} />
      <div className="kit-field">
        <span className="ai-connect__label-row">
          <label className="kit-label" htmlFor={keyId}>
            Clave de API
          </label>
          <a className="ai-connect__help" href={info.keysUrl} target="_blank" rel="noopener noreferrer">
            ¿Dónde la consigo?
          </a>
        </span>
        <input
          id={keyId}
          type="password"
          className="kit-input kit-input--mono nodrag"
          value={apiKey}
          placeholder={info.keyPlaceholder}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setApiKey(event.target.value)}
        />
        <p className="kit-hint">Se comprueba con {info.name} y se guarda cifrada en tu cuenta, no en el flujo.</p>
      </div>
      {error ? (
        <p className="ai-connect__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="ai-connect__actions">
        {onCancel ? (
          <button type="button" className="ai-connect__ghost nodrag" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
        ) : null}
        <button type="button" className="ai-connect__primary nodrag" onClick={() => void connect()} disabled={busy || apiKey.trim().length < 20}>
          {busy ? `Verificando con ${info.name}…` : "Conectar"}
        </button>
      </div>
    </div>
  );
}

export function AiConnectionSection({
  config,
  resources,
  onChange
}: {
  readonly config: AiConfig;
  readonly resources: ToolResources | undefined;
  readonly onChange: (patch: Partial<Pick<AiConfig, "credentialId" | "model">>) => void;
}) {
  const credentials = resources?.aiCredentials ?? [];
  const status = resources?.aiCredentialsStatus ?? "ready";
  const selected = credentials.find((credential) => credential.id === config.credentialId);
  const [connecting, setConnecting] = useState(false);
  const [models, setModels] = useState<ModelState>({ status: "idle" });
  const [custom, setCustom] = useState(false);
  const listAiModels = resources?.listAiModels;
  const provider = selected?.provider;

  // Modelos de la conexión elegida; si no se pueden leer, los sugeridos del proveedor.
  useEffect(() => {
    if (!config.credentialId || !provider) return;
    let alive = true;
    const suggested = AI_SUGGESTED_MODELS[provider];
    if (!listAiModels) {
      setModels({ status: "ready", models: suggested });
      return;
    }
    setModels({ status: "loading" });
    void listAiModels(config.credentialId).then((outcome) => {
      if (!alive) return;
      setModels(
        outcome.ok && outcome.value.length > 0
          ? { status: "ready", models: outcome.value }
          : { status: "fallback", models: suggested, message: outcome.ok ? "El proveedor no devolvió modelos." : outcome.message }
      );
    });
    return () => {
      alive = false;
    };
  }, [config.credentialId, provider, listAiModels]);

  const list = models.status === "ready" || models.status === "fallback" ? models.models : [];

  // Con la lista cargada y sin modelo elegido, se propone el recomendado de ese proveedor.
  // Nunca mientras se escribe un modelo propio: borrar el campo no es «elige tú».
  useEffect(() => {
    if (custom || config.model || list.length === 0 || !provider) return;
    const preferred = AI_SUGGESTED_MODELS[provider].find((model) => list.some((option) => option.id === model.id));
    onChange({ model: (preferred ?? list[0]!).id });
  }, [list, config.model, provider, custom, onChange]);

  const inList = list.some((model) => model.id === config.model);
  const showCustom = custom || (config.model !== "" && list.length > 0 && !inList);

  if (status === "forbidden") {
    return <Notice>Tu rol no permite usar las conexiones de IA de esta cuenta. Pide acceso a un administrador.</Notice>;
  }
  if (status === "unavailable") {
    return <Notice>Las conexiones de IA no están disponibles en este servidor (falta configurar el cifrado de claves).</Notice>;
  }

  if (credentials.length === 0 || connecting) {
    if (!resources?.createAiCredential) {
      return <Notice>Conecta una IA desde Integraciones para usar este bloque.</Notice>;
    }
    return (
      <>
        {credentials.length === 0 ? <p className="kit-hint">Conecta tu cuenta de IA. Solo la primera vez: después la eliges de la lista en cualquier bloque.</p> : null}
        <ConnectForm
          resources={resources}
          {...(credentials.length > 0 ? { onCancel: () => setConnecting(false) } : {})}
          onConnected={(credentialId) => {
            setConnecting(false);
            onChange({ credentialId, model: "" });
          }}
        />
      </>
    );
  }

  const credentialOptions: ReadonlyArray<Option<string>> = [
    ...(selected ? [] : [{ value: "", label: config.credentialId ? "La conexión elegida ya no existe" : "Elige una conexión…" }]),
    ...credentials.map((credential) => ({
      value: credential.id,
      label: `${aiProviderInfo(credential.provider).name} · ${credential.name} (${credential.hint})${credential.status === "invalid" ? " — clave rechazada" : ""}`
    }))
  ];
  const modelOptions: ReadonlyArray<Option<string>> = [...list.map((model) => ({ value: model.id, label: model.label })), { value: CUSTOM, label: "Otro modelo…" }];

  return (
    <>
      <SelectField
        label="Conexión de IA"
        value={selected ? selected.id : ""}
        options={credentialOptions}
        onChange={(credentialId) => {
          if (!credentialId) return;
          setCustom(false);
          onChange({ credentialId, model: "" });
        }}
      />
      {selected?.status === "invalid" ? <Notice>El proveedor rechazó la clave de esta conexión. Cámbiala en Integraciones o elige otra.</Notice> : null}
      <div className="ai-connect__links">
        <button type="button" className="ai-connect__link nodrag" onClick={() => setConnecting(true)}>
          + Conectar otra IA
        </button>
        <a className="ai-connect__link" href="/integrations" target="_blank" rel="noopener noreferrer">
          Administrar conexiones
        </a>
      </div>

      {selected ? (
        models.status === "loading" ? (
          <p className="kit-hint">Cargando los modelos de tu cuenta…</p>
        ) : (
          <>
            <SelectField
              label="Modelo"
              value={showCustom ? CUSTOM : config.model}
              options={modelOptions}
              {...(models.status === "fallback" ? { hint: `Mostramos modelos sugeridos: ${models.message}` } : {})}
              onChange={(model) => {
                if (model === CUSTOM) {
                  setCustom(true);
                  return;
                }
                setCustom(false);
                onChange({ model });
              }}
            />
            {showCustom ? (
              <TextField
                label="Identificador del modelo"
                value={config.model}
                monospace
                placeholder={provider === "openrouter" ? "proveedor/modelo" : "nombre-del-modelo"}
                hint="Tal como lo nombra el proveedor."
                onChange={(model) => onChange({ model: model.trim() })}
              />
            ) : null}
          </>
        )
      ) : null}
    </>
  );
}
