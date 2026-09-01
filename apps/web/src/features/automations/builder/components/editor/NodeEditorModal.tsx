import "./node-editor-modal.css";
import "../toolbar-button.css";
import { useEffect, useState } from "react";
import type { CanvasNode } from "@features/automations/builder/types/canvas";
import { resolveTool } from "@features/automations/builder/tools/registry";

interface NodeEditorModalProps {
  node: CanvasNode;
  onClose: () => void;
  onSave: (draft: { title: string; preview: string }) => void;
}

export function NodeEditorModal({ node, onClose, onSave }: NodeEditorModalProps) {
  const [title, setTitle] = useState(node.data.title);
  const [preview, setPreview] = useState(node.data.preview);
  const tool = resolveTool(node.data.nodeType);

  useEffect(() => {
    setTitle(node.data.title);
    setPreview(node.data.preview);
  }, [node.id, node.data.preview, node.data.title]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ title, preview });
  }

  return (
    <div className="editor-modal" role="presentation">
      <button type="button" className="editor-modal__backdrop" aria-label="Cerrar editor" onClick={onClose} />
      <section className="editor-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="node-editor-title">
        <header className="editor-modal__header">
          <div className="editor-modal__heading">
            <span className={`editor-modal__type editor-modal__type--${node.data.nodeType}`}>{node.data.nodeType}</span>
            <div>
              <h2 id="node-editor-title">{tool.editorTitle}</h2>
              <p>Configura el contenido del bloque sin exponer paneles permanentes sobre el canvas.</p>
            </div>
          </div>
          <button type="button" className="editor-modal__close" aria-label="Cerrar" onClick={onClose}>
            x
          </button>
        </header>

        <form className="editor-modal__form" onSubmit={handleSubmit}>
          <div className="editor-modal__body">
            <section className="editor-modal__section">
              <label className="editor-modal__field">
                <span>Nombre del bloque</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nombre interno del bloque" />
              </label>

              <label className="editor-modal__field">
                <span>Contenido principal</span>
                <textarea value={preview} onChange={(event) => setPreview(event.target.value)} placeholder="Escribe el mensaje o la instrucción principal" />
              </label>
            </section>

            <aside className="editor-modal__aside">
              <article className="editor-modal__meta-card">
                <span>Tipo</span>
                <strong>{node.data.nodeType}</strong>
                <p>{node.data.configSummary}</p>
              </article>

              <article className="editor-modal__meta-card">
                <span>Estado</span>
                <strong>{node.data.isTerminal ? "Bloque terminal" : "Bloque activo"}</strong>
                <p>{node.data.isTerminal ? "Cierra una rama del flujo." : "Puede conectarse con bloques posteriores."}</p>
              </article>

              <article className="editor-modal__meta-card editor-modal__meta-card--preview">
                <span>Vista previa</span>
                <strong>Cómo se ve este bloque</strong>
                <p>{preview || "Aún no hay contenido configurado para este bloque."}</p>
              </article>
            </aside>
          </div>

          <footer className="editor-modal__footer">
            <button type="button" className="toolbar-button toolbar-button--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="toolbar-button toolbar-button--primary">
              Guardar
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}