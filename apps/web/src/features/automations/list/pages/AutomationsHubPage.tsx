import "../components/hub-chrome.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAutomationList } from "../hooks/useAutomationList";
import { useAutomationActions } from "../hooks/useAutomationActions";
import { useCreateFolder } from "../hooks/useCreateFolder";
import { useActiveTenant } from "@shared/auth/tenant/ActiveTenantContext";
import { AutomationEmptyState } from "../components/AutomationEmptyState";
import { AutomationFlowCard } from "../components/AutomationFlowCard";
import { AutomationSection } from "../components/AutomationSection";
import { AutomationsHubHeader } from "../components/AutomationsHubHeader";
import { AutomationsToolbar } from "../components/AutomationsToolbar";
import { CreateFolderModal } from "../components/CreateFolderModal";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { RenameFlowModal } from "../components/RenameFlowModal";
import { FolderCard } from "../components/FolderCard";
import { createAutomationDraft } from "../services/createAutomationDraft";

export function AutomationsHubPage() {
  const navigate = useNavigate();
  const { activeTenantId } = useActiveTenant();
  const [search, setSearch] = useState("");
  const state = useAutomationList(activeTenantId ?? "");

  // Borrar, renombrar y crear carpeta comparten la misma respuesta: recargar.
  // El servidor es la única fuente de verdad, así que la página no mantiene
  // ninguna copia local que pudiera divergir de él.
  const actions = useAutomationActions({
    onFlowDeleted: state.refresh,
    onFlowRenamed: state.refresh
  });

  // Al crear una carpeta se recarga la lista: el servidor sigue siendo la
  // única fuente de verdad y `hasContent` pasa solo de vacío a con contenido.
  const folderCreation = useCreateFolder({ onFolderCreated: state.refresh });

  const handleCreateFlow = () => {
    navigate(`/builder/${createAutomationDraft()}`);
  };

  // Plantillas aún no existen como funcionalidad: la acción sólo lleva a la
  // ruta que ya declara AppRouter, cuyo placeholder dice honestamente que no
  // está implementado. Sin plantillas inventadas ni backend ficticio.
  const handleExploreTemplates = () => {
    navigate("/automations/templates");
  };

  if (state.status === "loading") {
    return (
      <div className="hub-shell">
        <AutomationsHubHeader hasContent={false} onCreateFlow={handleCreateFlow} />
        <div className="hub-state-msg">Cargando automatizaciones...</div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="hub-shell">
        <AutomationsHubHeader hasContent={false} onCreateFlow={handleCreateFlow} />
        <div className="hub-state-msg hub-state-msg--error">Error: {state.message}</div>
      </div>
    );
  }

  const { flows, folders } = state.data;
  const filtered = flows.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  // Estado derivado de la lista real: decide dónde viven las acciones de
  // creación (empty state central vs. cabecera), nunca en ambos sitios.
  const hasContent = flows.length > 0 || folders.length > 0;

  return (
    <>
      <div className="hub-shell">
        <AutomationsHubHeader hasContent={hasContent} onCreateFlow={handleCreateFlow} />
        {/* Revalidación fallida: los datos en pantalla siguen siendo los
            últimos buenos, así que se avisa sin desmontar nada. */}
        {state.refreshError && (
          <p className="hub-refresh-error" role="status">
            No se pudo actualizar la lista. Estás viendo los últimos datos disponibles.
          </p>
        )}
        {!hasContent ? (
          <AutomationEmptyState
            onCreateFlow={handleCreateFlow}
            onCreateFolder={folderCreation.open}
            onExploreTemplates={handleExploreTemplates}
          />
        ) : (
          <>
            <AutomationsToolbar
              search={search}
              onSearchChange={setSearch}
              onCreateFolder={folderCreation.open}
            />
            {folders.length > 0 && (
              <AutomationSection title="Carpetas" gridClass="hub-folder-grid">
                {folders.map((folder) => (
                  <FolderCard key={folder.id} folder={folder} />
                ))}
              </AutomationSection>
            )}
            <AutomationSection title="Flujos">
              {filtered.map((flow) => (
                <AutomationFlowCard
                  key={flow.id}
                  flow={flow}
                  onDelete={actions.requestDelete}
                  onRename={actions.requestRename}
                />
              ))}
            </AutomationSection>
          </>
        )}
      </div>

      {folderCreation.isOpen && (
        <CreateFolderModal
          busy={folderCreation.busy}
          error={folderCreation.error}
          onConfirm={(name) => void folderCreation.submit(name)}
          onCancel={folderCreation.close}
        />
      )}

      {actions.modal?.type === "delete" && (
        <DeleteConfirmModal
          flowName={actions.modal.flow.name}
          onConfirm={() => void actions.confirmDelete()}
          onCancel={actions.cancelModal}
        />
      )}

      {actions.modal?.type === "rename" && (
        <RenameFlowModal
          currentName={actions.modal.flow.name}
          onConfirm={(newName) => void actions.confirmRename(newName)}
          onCancel={actions.cancelModal}
        />
      )}
    </>
  );
}

