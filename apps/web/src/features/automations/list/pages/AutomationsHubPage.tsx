import "../components/hub-chrome.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAutomationList } from "../hooks/useAutomationList";
import { useAutomationActions } from "../hooks/useAutomationActions";
import { useCreateFolder } from "../hooks/useCreateFolder";
import { useHubLocation } from "../hooks/useHubLocation";
import { useMoveFlowToFolder } from "../hooks/useMoveFlowToFolder";
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
import { FolderEmptyState } from "../components/FolderEmptyState";
import { HubBreadcrumb } from "../components/HubBreadcrumb";
import { selectHubContents } from "../services/selectHubContents";
import { createAutomationDraft } from "../services/createAutomationDraft";

export function AutomationsHubPage() {
  const navigate = useNavigate();
  const { activeTenantId } = useActiveTenant();
  const [search, setSearch] = useState("");
  // Dónde estamos: la raíz, o dentro de una carpeta. Lo dice la ruta.
  const location = useHubLocation();
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
  // Mover un flujo de carpeta: el hub coordina, el hook llama al servicio y la
  // lista del servidor sigue siendo la única verdad sobre dónde está cada uno.
  const flowMove = useMoveFlowToFolder({ onFlowMoved: state.refresh });

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
        <AutomationsHubHeader />
        <div className="hub-state-msg">Cargando automatizaciones...</div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="hub-shell">
        <AutomationsHubHeader />
        <div className="hub-state-msg hub-state-msg--error">Error: {state.message}</div>
      </div>
    );
  }

  const { flows, folders } = state.data;
  // Qué se ve aquí lo decide una función pura, la misma para la raíz y para
  // dentro de una carpeta: sin ella la regla estaría escrita dos veces.
  const contents = selectHubContents(flows, folders, { folderId: location.folderId }, search);
  const dentroDeCarpeta = contents.currentFolder !== null;

  // Estado derivado de la lista real: decide dónde viven las acciones de
  // creación (empty state central vs. cabecera), nunca en ambos sitios.
  const hasContent = flows.length > 0 || folders.length > 0;

  return (
    <>
      <div className="hub-shell">
        <AutomationsHubHeader />
        {/* Revalidación fallida: los datos en pantalla siguen siendo los
            últimos buenos, así que se avisa sin desmontar nada. */}
        {/* Un movimiento que falló no puede quedarse en silencio: la lista
            sigue mostrando dónde está el flujo de verdad. */}
        {/* Dentro de una carpeta: dónde estoy y el camino de vuelta, que es
            además el destino para sacar una automatización de aquí. */}
        {contents.currentFolder && (
          <HubBreadcrumb
            folderName={contents.currentFolder.name}
            onGoToRoot={location.goToRoot}
            onDropFlowToRoot={(flowId) => void flowMove.moveToFolder(flowId, null)}
          />
        )}
        {flowMove.error && (
          <p className="hub-refresh-error" role="status">
            {flowMove.error}
          </p>
        )}
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
              onCreateFlow={handleCreateFlow}
            />
            {contents.folders.length > 0 && (
              <AutomationSection
                title={dentroDeCarpeta ? "Mover a otra carpeta" : "Carpetas"}
                gridClass="hub-folder-grid"
              >
                {contents.folders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    flowCount={contents.countByFolder.get(folder.id) ?? 0}
                    onClick={location.openFolder}
                    onDropFlow={(flowId, folderId) => void flowMove.moveToFolder(flowId, folderId)}
                  />
                ))}
              </AutomationSection>
            )}
            {dentroDeCarpeta && contents.isEmpty && <FolderEmptyState />}
            <AutomationSection title="Flujos">
              {contents.flows.map((flow) => (
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

