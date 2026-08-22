import "./panel-shell.css";
import "./release-panel.css";
import "../toolbar-button.css";
interface ReleasePanelProps {
  autosaveStatus: "idle" | "saving" | "saved" | "error";
  publishedCount: number;
  updatedAt: string | null;
  onPublish: () => Promise<void>;
  onRollback: () => Promise<void>;
}

export function ReleasePanel(props: ReleasePanelProps) {
  return (
    <section className="sidebar-panel">
      <div className="sidebar-panel__header">
        <p>Estado del flujo</p>
        <span>Versionado</span>
      </div>
      <div className="release-panel__chips">
        <span className="release-chip">
          <small>Autosave</small>
          <strong>{props.autosaveStatus}</strong>
        </span>
        <span className="release-chip">
          <small>Publicadas</small>
          <strong>{props.publishedCount}</strong>
        </span>
      </div>
      <p className="release-panel__timestamp">Última actualización: {props.updatedAt ? new Date(props.updatedAt).toLocaleString() : "sin datos"}</p>
      <div className="release-panel__actions">
        <button type="button" className="toolbar-button toolbar-button--ghost" onClick={() => void props.onRollback()}>Rollback</button>
        <button type="button" className="toolbar-button toolbar-button--primary" onClick={() => void props.onPublish()}>Publicar</button>
      </div>
    </section>
  );
}