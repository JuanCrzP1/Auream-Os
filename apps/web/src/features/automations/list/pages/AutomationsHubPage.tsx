import "../components/hub-chrome.css";
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAutomationList } from "../hooks/useAutomationList";
import { useAutomationActions } from "../hooks/useAutomationActions";
import { useActiveTenant } from "@shared/auth/tenant/ActiveTenantContext";
import { AutomationEmptyState } from "../components/AutomationEmptyState";
import { AutomationFlowCard } from "../components/AutomationFlowCard";
import { AutomationSection } from "../components/AutomationSection";
import { AutomationsHubHeader } from "../components/AutomationsHubHeader";
import { AutomationsToolbar } from "../components/AutomationsToolbar";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { RenameFlowModal } from "../components/RenameFlowModal";
import { FolderCard } from "../components/FolderCard";
import { createAutomationDraft } from "../services/createAutomationDraft";
import type { AutomationSummary } from "@contracts/AutomationContracts";

export function AutomationsHubPage() {
  const navigate = useNavigate();
  const { activeTenantId } = useActiveTenant();
  const [search, setSearch] = useState("");
  const state = useAutomationList(activeTenantId ?? "");

  const handleFlowDeleted = useCallback((flowId: string) => {
    if (state.status === "success") {
      // Optimistic: remove from local state, no reload needed
      const updated = state.data.flows.filter((f) => f.id !== flowId);
      // Trigger full refresh to keep server as source of truth
      state.refresh();
      void updated; // suppress lint warning
    }
  }, [state]);

  const handleFlowRenamed = useCallback((updated: AutomationSummary) => {
    state.refresh();
    void updated;
  }, [state]);

  const actions = useAutomationActions({
    onFlowDeleted: handleFlowDeleted,
    onFlowRenamed: handleFlowRenamed
  });

  const handleCreateFlow = () => {
    navigate(`/builder/${createAutomationDraft()}`);
  };

  if (state.status === "loading") {
    return (
      <div className="hub-shell">
        <AutomationsHubHeader onCreateFlow={handleCreateFlow} />
        <div className="hub-state-msg">Cargando automatizaciones...</div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="hub-shell">
        <AutomationsHubHeader onCreateFlow={handleCreateFlow} />
        <div className="hub-state-msg hub-state-msg--error">Error: {state.message}</div>
      </div>
    );
  }

  const { flows, folders } = state.data;
  const filtered = flows.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="hub-shell">
        <AutomationsHubHeader onCreateFlow={handleCreateFlow} />
        {flows.length === 0 && folders.length === 0 ? (
          <AutomationEmptyState onCreateFlow={handleCreateFlow} />
        ) : (
          <>
            <AutomationsToolbar search={search} onSearchChange={setSearch} />
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

