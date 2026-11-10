import "./webhooks.css";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useConnections } from "@shared/connections/useConnections";
import { useLabelCatalog } from "@shared/labels/useLabelCatalog";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { IntegrationMark } from "@shared/ui/integration-kit/IntegrationMark";
import { useWebhookEditor } from "./useWebhookEditor";
import { assignPath, targetLabel, type PathTarget } from "./mappingTarget";
import { WebhookAddressCard } from "./WebhookAddressCard";
import { PayloadTree } from "./PayloadTree";
import { ContactMappingSection } from "./ContactMappingSection";
import { WebhookActionsSection } from "./WebhookActionsSection";
import { WebhookHistory } from "./WebhookHistory";

/**
 * La página de un webhook (`/integrations/webhooks/<id>`), como la de Leona:
 * su dirección y la escucha del envío de ejemplo; a la izquierda el árbol de
 * datos, a la derecha el mapeo (contacto, campos, etiquetas, flujo); el
 * historial en su pestaña. Todo se guarda junto con «Guardar cambios».
 */
export function WebhookEditorPage({ itemId }: { readonly itemId: string }) {
  const editor = useWebhookEditor(itemId);
  const { connections } = useConnections();
  const catalog = useLabelCatalog();
  const [tab, setTab] = useState<"config" | "history">("config");
  const [target, setTarget] = useState<PathTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (editor.status === "not_found" || editor.status === "error") {
    return (
      <div className="ui-page">
        <div className="ui-panel">
          <StateCard
            icon={editor.status === "not_found" ? StateIcons.search : StateIcons.offline}
            title={editor.status === "not_found" ? "Este webhook no existe" : "No pudimos cargar el webhook"}
            description={editor.status === "not_found" ? "Puede que lo hayan eliminado." : "Vuelve a intentarlo en unos segundos."}
            actions={<Link className="ui-btn ui-btn--primary" to="/integrations/webhooks">Ver webhooks</Link>}
          />
        </div>
      </div>
    );
  }
  const { webhook, draft } = editor;
  if (!webhook || !draft) return <div className="ui-page" aria-busy="true" />;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await editor.save();
      setSaved(true);
      setTimeout(() => setSaved(false), 2_500);
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo guardar. Inténtalo de nuevo."));
    } finally {
      setSaving(false);
    }
  };
  const label = targetLabel(draft.mapping, target);

  return (
    <div className="ui-page">
      <header className="ui-page__header">
        <div className="integration-detail__heading">
          <nav className="integration-detail__crumbs" aria-label="Ruta">
            <Link to="/integrations">Integraciones</Link>
            <span aria-hidden="true">›</span>
            <Link to="/integrations/webhooks">Webhooks de entrada</Link>
          </nav>
          <div className="integration-detail__title">
            <IntegrationMark kind="webhook" size="lg" />
            <div>
              <input className="webhook-name" aria-label="Nombre del webhook" value={draft.name} maxLength={60} onChange={(event) => editor.setDraft({ ...draft, name: event.target.value })} />
              <p className="ui-page__subtitle">{draft.enabled ? "Activo: procesa lo que llega." : "Pausado: lo que llega solo queda en el historial."}</p>
            </div>
          </div>
        </div>
        <label className="webhook-switch">
          <input type="checkbox" role="switch" checked={draft.enabled} onChange={(event) => editor.setDraft({ ...draft, enabled: event.target.checked })} />
          <span>{draft.enabled ? "Activo" : "Pausado"}</span>
        </label>
      </header>

      <nav className="ui-tabs" role="tablist" aria-label="Secciones del webhook">
        <button type="button" role="tab" className="ui-tab" aria-selected={tab === "config"} onClick={() => setTab("config")}>Configuración</button>
        <button type="button" role="tab" className="ui-tab" aria-selected={tab === "history"} onClick={() => setTab("history")}>Historial</button>
      </nav>

      {tab === "history" ? (
        <div className="ui-panel">
          <WebhookHistory history={editor.history} onLoad={editor.loadHistory} />
        </div>
      ) : (
        <div className="ui-panel webhook-editor">
          <WebhookAddressCard url={webhook.url} sampleReceivedAt={webhook.sampleReceivedAt} listening={editor.listening} onListen={editor.listen} onCancel={editor.cancelListening} />
          <div className="webhook-editor__columns">
            <section className="webhook-card webhook-sample" aria-labelledby="webhook-sample-title">
              <h2 id="webhook-sample-title">Datos del envío de ejemplo</h2>
              {webhook.sample ? (
                <>
                  <p className="ui-muted">{label ? `Haz clic en un dato para usarlo en ${label}.` : "Elige un campo a la derecha y haz clic en un dato."}</p>
                  <PayloadTree sample={webhook.sample} onPick={(path) => editor.setDraft({ ...draft, mapping: assignPath(draft.mapping, target, path) })} />
                </>
              ) : (
                <p className="ui-muted">Cuando llegue el primer envío verás aquí sus datos para mapearlos con un clic.</p>
              )}
            </section>
            <div className="webhook-editor__mapping">
              <ContactMappingSection mapping={draft.mapping} target={target} onTarget={setTarget} onChange={(mapping) => editor.setDraft({ ...draft, mapping })} />
              <WebhookActionsSection
                mapping={draft.mapping}
                connectionId={draft.connectionId}
                connections={connections}
                labelNames={catalog.labels.map((item) => item.name)}
                onMapping={(mapping) => editor.setDraft({ ...draft, mapping })}
                onConnection={(connectionId) => editor.setDraft({ ...draft, connectionId, mapping: connectionId ? draft.mapping : { ...draft.mapping, flowId: "" } })}
              />
            </div>
          </div>
        </div>
      )}

      <footer className={`webhook-savebar${editor.dirty || error || saved ? " webhook-savebar--visible" : ""}`}>
        {error ? <p className="ui-error" role="alert">{error}</p> : <p className="ui-muted">{saved ? "Cambios guardados." : editor.dirty ? "Tienes cambios sin guardar." : ""}</p>}
        <button type="button" className="ui-btn ui-btn--primary" disabled={!editor.dirty || saving} onClick={() => void save()}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </footer>
    </div>
  );
}
