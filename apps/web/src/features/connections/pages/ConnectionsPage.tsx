import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import "../components/connections.css";
import { useEffect, useState } from "react";
import type { ConnectionMethod, ConnectionSummary } from "@contracts/ConnectionContracts";
import { useConnections } from "@shared/connections/useConnections";
import { StateCard, RetryButton } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { WhatsAppConnectionCard } from "../components/WhatsAppConnectionCard";
import { ConnectionsOverview } from "../components/ConnectionsOverview";
import { METHOD_OPTIONS, NewConnectionDialog } from "../components/NewConnectionDialog";
import { LinkConnectionDialog } from "../components/LinkConnectionDialog";
import { RenameConnectionDialog } from "../components/RenameConnectionDialog";
import { ConnectionTriggersDialog } from "../components/triggers/ConnectionTriggersDialog";
import { DeleteConnectionDialog, DisconnectConnectionDialog } from "../components/ConnectionConfirmDialogs";
import type { ConnectionAction } from "../components/connectionActions";
import { ChatPhoneGlyph, PlusGlyph } from "../components/ConnectionGlyphs";

/**
 * ConnectionsPage — los números de WhatsApp de la cuenta: su estado de un
 * vistazo, crear uno (QR o API oficial), vincularlo o reconectarlo, reiniciar
 * su conexión, desconectarlo, elegir qué flujos inicia (disparadores),
 * renombrarlo o eliminarlo.
 * La lista viene del servidor; esta página solo ordena las piezas.
 */

type Dialog =
  | { readonly kind: "new"; readonly method?: ConnectionMethod }
  | { readonly kind: "link" | "triggers" | "rename" | "delete" | "disconnect"; readonly connection: ConnectionSummary }
  | null;

export function ConnectionsPage() {
  const connections = useConnections();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [retrying, setRetrying] = useState(false);
  const [notice, setNotice] = useState<{ readonly tone: "ok" | "error"; readonly text: string } | null>(null);
  const list = connections.connections;

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /** Reiniciar no pide confirmación (no desvincula): se avisa cómo fue. */
  const restart = async (connection: ConnectionSummary) => {
    try {
      await connections.restart(connection.id);
      setNotice({ tone: "ok", text: `Reiniciando la conexión de «${connection.name}». En unos segundos vuelve a recibir y enviar.` });
    } catch (error) {
      setNotice({ tone: "error", text: apiErrorMessage(error, "No se pudo reiniciar la conexión. Inténtalo de nuevo.") });
    }
  };

  const act = (connection: ConnectionSummary, action: ConnectionAction) => {
    if (action === "restart") void restart(connection);
    else if (action === "link") setDialog({ kind: "link", connection });
    else setDialog({ kind: action, connection });
  };

  const retry = async () => {
    setRetrying(true);
    await connections.refresh();
    setRetrying(false);
  };

  return (
    <div className="ui-page">
      <header className="ui-page__header">
        <div>
          <h1 className="ui-page__title">Conexiones</h1>
          <p className="ui-page__subtitle">Los números de WhatsApp con los que tus flujos atienden a tus clientes.</p>
        </div>
        {connections.status === "ready" && list.length > 0 ? (
          <button type="button" className="ui-btn ui-btn--primary wa-new" onClick={() => setDialog({ kind: "new" })}>
            <PlusGlyph />
            Nueva conexión
          </button>
        ) : null}
      </header>

      <div className="ui-panel">
        {notice ? (
          <p className={`wa-notice wa-notice--${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
            {notice.text}
          </p>
        ) : null}
        {connections.status === "loading" ? (
          <div className="wa-grid" aria-busy="true" aria-label="Cargando conexiones">
            {[0, 1, 2].map((index) => (
              <div key={index} className="wa-card wa-card--skeleton" aria-hidden="true" />
            ))}
          </div>
        ) : null}

        {connections.status === "error" ? (
          <StateCard
            icon={StateIcons.offline}
            tone="warning"
            role="alert"
            title="No pudimos cargar tus conexiones"
            description="Revisa tu conexión a internet e inténtalo de nuevo."
            actions={<RetryButton busy={retrying} onRetry={() => void retry()} />}
          />
        ) : null}

        {connections.status === "forbidden" ? (
          <StateCard icon={StateIcons.lock} title="Sin acceso a las conexiones" description="Tu rol en esta cuenta no permite ver los números de WhatsApp. Pídeselo a un administrador." />
        ) : null}

        {connections.status === "ready" && list.length === 0 ? (
          <section className="wa-empty" aria-labelledby="wa-empty-title">
            <span className="wa-empty__icon" aria-hidden="true"><ChatPhoneGlyph /></span>
            <h2 id="wa-empty-title" className="wa-empty__title">Conecta tu primer número de WhatsApp</h2>
            <p className="wa-empty__text">Elige cómo conectarlo. Puedes tener varios números y combinar las dos formas.</p>
            <div className="wa-empty__options">
              {METHOD_OPTIONS.map((option) => (
                <button key={option.method} type="button" className={`wa-method-card wa-method-card--${option.method}`} onClick={() => setDialog({ kind: "new", method: option.method })}>
                  <span className="wa-method-card__head">
                    <span className="wa-method-card__icon" aria-hidden="true">{option.icon}</span>
                    <span className="wa-method-card__badge">{option.badge}</span>
                  </span>
                  <span className="wa-method-card__title">{option.cta}</span>
                  <span className="wa-method-card__description">{option.description}</span>
                  <span className="wa-method-card__facts">
                    {option.facts.map((fact) => (
                      <span key={fact} className="wa-method-card__fact">{fact}</span>
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {connections.status === "ready" && list.length > 0 ? (
          <>
            <ConnectionsOverview connections={list} />
            <div className="wa-grid">
              {list.map((connection) => (
                <WhatsAppConnectionCard key={connection.id} connection={connection} onAction={(action) => act(connection, action)} />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {dialog?.kind === "new" ? (
        <NewConnectionDialog
          initialMethod={dialog.method}
          onCreate={connections.create}
          // Recién creada, sigue directo a vincular el número.
          onCreated={(connection) => setDialog({ kind: "link", connection })}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "link" ? <LinkConnectionDialog
          connection={dialog.connection}
          onLink={connections.link}
          onCheck={connections.check}
          onClose={() => {
            setDialog(null);
            void connections.refresh();
          }}
        /> : null}
      {dialog?.kind === "triggers" ? (
        <ConnectionTriggersDialog
          connection={dialog.connection}
          onClose={() => {
            setDialog(null);
            void connections.refresh();
          }}
        />
      ) : null}
      {dialog?.kind === "rename" ? (
        <RenameConnectionDialog name={dialog.connection.name} onSave={(name) => connections.rename(dialog.connection.id, name)} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === "delete" ? <DeleteConnectionDialog connection={dialog.connection} onConfirm={() => connections.remove(dialog.connection.id)} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "disconnect" ? (
        <DisconnectConnectionDialog connection={dialog.connection} onConfirm={() => connections.disconnect(dialog.connection.id)} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}
