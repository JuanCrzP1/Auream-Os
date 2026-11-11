import "./campaign-editor.css";
import { useEffect, useState } from "react";
import { GROUP_LIMITS, type SaveCampaignRequest } from "@contracts/GroupContracts";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import { fetchConnections } from "@shared/connections/connectionsApi";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { groupsApi } from "../services/groupsApi";
import { draftProblem, emptyCampaign, fromSummary, slugify } from "./campaignDraft";
import { GroupPreview } from "./GroupPreview";
import { TemplateFields } from "./TemplateFields";

/** Crear o editar una campaña de grupos: enlace, números, cupo, cómo es cada grupo y lo automático. */
export function CampaignEditor({ campaignId, onClose, onSaved }: { readonly campaignId: string | null; readonly onClose: () => void; readonly onSaved: (id: string) => void }) {
  const [draft, setDraft] = useState<SaveCampaignRequest>(emptyCampaign);
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [slugTouched, setSlugTouched] = useState(Boolean(campaignId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (patch: Partial<SaveCampaignRequest>) => setDraft((current) => ({ ...current, ...patch }));

  useEffect(() => {
    void fetchConnections().then((list) => {
      setConnections(list);
      if (!campaignId) update({ connectionIds: list.filter((c) => c.method === "qr" && c.status === "connected").slice(0, 1).map((c) => c.id) });
    }).catch(() => undefined);
    if (campaignId) void groupsApi.campaign(campaignId).then((detail) => setDraft(fromSummary(detail.campaign))).catch(() => setError("No pudimos cargar la campaña."));
  }, [campaignId]);

  const setName = (name: string) => update({ name, ...(slugTouched ? {} : { slug: slugify(name) }), template: { ...draft.template, namePattern: draft.template.namePattern && draft.template.namePattern !== draft.name.slice(0, GROUP_LIMITS.maxNamePattern) ? draft.template.namePattern : name.slice(0, GROUP_LIMITS.maxNamePattern) } });
  const toggleNumber = (id: string) => update({ connectionIds: draft.connectionIds.includes(id) ? draft.connectionIds.filter((x) => x !== id) : [...draft.connectionIds, id] });
  const problem = draftProblem(draft);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = campaignId ? await groupsApi.update(campaignId, draft) : await groupsApi.create(draft);
      onSaved(saved.id);
    } catch (failure) {
      setError(apiErrorMessage(failure, "No se pudo guardar la campaña."));
      setBusy(false);
    }
  };

  return (
    <div className="ui-page gr-editor">
      <header className="gr-editor__header">
        <button type="button" className="gr-editor__back" onClick={onClose} aria-label="Volver">←</button>
        <div>
          <h1 className="ui-page__title">{campaignId ? "Editar campaña" : "Nueva campaña de grupos"}</h1>
          <p className="ui-page__subtitle">{campaignId ? "Los cambios llegan a todos los grupos de la campaña." : "El primer grupo se crea solo apenas la guardes."}</p>
        </div>
      </header>
      <div className="gr-editor__body">
        <section className="gr-editor__card" aria-label="La campaña">
          <div className="gr-editor__grid">
            <label className="ui-field">
              <span>Nombre de la campaña</span>
              <input className="ui-input" value={draft.name} maxLength={60} placeholder="Ej. Lanzamiento Navidad" onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="ui-field">
              <span>Enlace</span>
              <span className="gr-editor__slug">
                <span>/g/</span>
                <input className="ui-input" value={draft.slug} maxLength={40} aria-label="Enlace" onChange={(event) => { setSlugTouched(true); update({ slug: slugify(event.target.value) || event.target.value.toLowerCase() }); }} />
              </span>
            </label>
          </div>
          <div className="gr-editor__group">
            <span className="gr-editor__label">Números que crean los grupos (por turnos)</span>
            <div className="gr-editor__numbers">
              {connections.map((connection) => {
                const usable = connection.method === "qr";
                return (
                  <button key={connection.id} type="button" className="gr-editor__number" aria-pressed={draft.connectionIds.includes(connection.id)} disabled={!usable} onClick={() => toggleNumber(connection.id)}>
                    <strong>{connection.name}</strong>
                    <span>{!usable ? "API oficial: grupos más adelante" : connection.status === "connected" ? "Conectado" : "Desconectado: vincúlalo para crear grupos"}</span>
                  </button>
                );
              })}
              {connections.length === 0 ? <span className="ui-muted">Conecta un número con QR en Conexiones.</span> : null}
            </div>
          </div>
          <TemplateFields draft={draft} update={update} />
          {error ? <p className="ui-error" role="alert">{error}</p> : null}
          <footer className="gr-editor__footer">
            <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>Cancelar</button>
            <span className="gr-editor__problem">{problem}</span>
            <button type="button" className="ui-btn ui-btn--primary" disabled={Boolean(problem) || busy} onClick={() => void save()}>{busy ? "Guardando…" : campaignId ? "Guardar y aplicar a los grupos" : "Crear campaña"}</button>
          </footer>
        </section>
        <aside className="gr-editor__aside"><GroupPreview draft={draft} /></aside>
      </div>
    </div>
  );
}
