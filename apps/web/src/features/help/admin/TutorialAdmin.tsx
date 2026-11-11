import { useEffect, useState } from "react";
import { HELP_MODULES, type SaveTutorialRequest, type Tutorial } from "@contracts/HelpContracts";
import { helpApi } from "@shared/help/helpApi";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";

const EMPTY: SaveTutorialRequest = { url: "", title: "", description: "", module: "primeros-pasos", duration: "", articleSlug: null, featured: false, published: false };

/** La lista de tutoriales (subir y bajar el orden) y el formulario: pegar el enlace, módulo, publicar. */
export function TutorialAdmin() {
  const [list, setList] = useState<Tutorial[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<SaveTutorialRequest>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void helpApi.tutorials(true).then(setList).catch(() => setError("No pudimos cargar los tutoriales."));
  }, []);

  const pick = (tutorial: Tutorial | null) => {
    setEditing(tutorial?.id ?? null);
    setError(null);
    setDraft(tutorial ? { url: tutorial.embedUrl, title: tutorial.title, description: tutorial.description, module: tutorial.module, duration: tutorial.duration, articleSlug: tutorial.articleSlug, featured: tutorial.featured, published: tutorial.published } : EMPTY);
  };
  const update = (patch: Partial<SaveTutorialRequest>) => setDraft((current) => ({ ...current, ...patch }));
  const save = async (published: boolean) => {
    setBusy(true);
    setError(null);
    try {
      setList(await helpApi.saveTutorial(editing, { ...draft, published }));
      pick(null);
    } catch (failure) {
      setError(apiErrorMessage(failure, "No se pudo guardar."));
    } finally {
      setBusy(false);
    }
  };
  const move = async (index: number, delta: number) => {
    const ids = list.map((t) => t.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved!);
    setList(await helpApi.reorder(ids));
  };

  return (
    <div className="help-admin__body">
      <section className="help-admin__list" aria-label="Tutoriales">
        <div className="help-admin__list-head"><strong>{list.length} tutoriales</strong><button type="button" className="ui-btn" onClick={() => pick(null)}>+ Nuevo</button></div>
        {list.map((tutorial, index) => (
          <div key={tutorial.id} className={`help-admin__row${editing === tutorial.id ? " help-admin__row--on" : ""}`}>
            <span className="help-admin__order">
              <button type="button" aria-label="Subir" disabled={index === 0} onClick={() => void move(index, -1)}>▲</button>
              <button type="button" aria-label="Bajar" disabled={index === list.length - 1} onClick={() => void move(index, 1)}>▼</button>
            </span>
            <button type="button" className="help-admin__pick" onClick={() => pick(tutorial)}>
              <strong>{tutorial.title}</strong>
              <small>{HELP_MODULES.find((m) => m.id === tutorial.module)?.name} · {tutorial.views} vistas{tutorial.featured ? " · destacado" : ""}</small>
            </button>
            <span className={`help-admin__state${tutorial.published ? " help-admin__state--on" : ""}`}>{tutorial.published ? "Publicado" : "Borrador"}</span>
          </div>
        ))}
        {list.length === 0 ? <p className="ui-muted">Aún no hay tutoriales. Sube tu primer video a YouTube (como «no listado») y pega aquí el enlace.</p> : null}
      </section>
      <section className="help-admin__form" aria-label={editing ? "Editar tutorial" : "Nuevo tutorial"}>
        <h2>{editing ? "Editar tutorial" : "Nuevo tutorial"}</h2>
        <label className="ui-field"><span>Enlace de YouTube o Vimeo</span><input className="ui-input" value={draft.url} placeholder="https://youtu.be/…" onChange={(e) => update({ url: e.target.value })} /></label>
        <label className="ui-field"><span>Título</span><input className="ui-input" value={draft.title} maxLength={120} onChange={(e) => update({ title: e.target.value })} /></label>
        <label className="ui-field"><span>Descripción corta</span><textarea className="ui-input" rows={2} maxLength={300} value={draft.description} onChange={(e) => update({ description: e.target.value })} /></label>
        <div className="help-admin__grid">
          <label className="ui-field"><span>Módulo</span><select className="ui-input" value={draft.module} onChange={(e) => update({ module: e.target.value as SaveTutorialRequest["module"] })}>{HELP_MODULES.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          <label className="ui-field"><span>Duración</span><input className="ui-input" value={draft.duration} placeholder="4:12" maxLength={8} onChange={(e) => update({ duration: e.target.value })} /></label>
        </div>
        <label className="ui-field"><span>Mostrar dentro del artículo (su slug, opcional)</span><input className="ui-input" value={draft.articleSlug ?? ""} placeholder="conectar-whatsapp-qr" onChange={(e) => update({ articleSlug: e.target.value.trim() || null })} /></label>
        <label className="help-admin__check"><input type="checkbox" checked={draft.featured} onChange={(e) => update({ featured: e.target.checked })} /> Destacar en «Empieza por aquí»</label>
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="help-admin__actions">
          <button type="button" className="ui-btn" disabled={busy} onClick={() => void save(false)}>Guardar borrador</button>
          <button type="button" className="ui-btn ui-btn--primary" disabled={busy} onClick={() => void save(true)}>Publicar para todos</button>
        </div>
        {editing ? <button type="button" className="ui-link help-admin__remove" onClick={() => void helpApi.removeTutorial(editing).then((next) => { setList(next); pick(null); })}>Quitar este tutorial</button> : null}
      </section>
    </div>
  );
}
