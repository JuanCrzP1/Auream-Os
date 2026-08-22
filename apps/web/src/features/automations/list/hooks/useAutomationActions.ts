import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { deleteAutomation } from "../services/deleteAutomation";
import { renameAutomation } from "../services/renameAutomation";
import type { AutomationSummary } from "@contracts/AutomationContracts";

export type AutomationActionModal =
  | { type: "delete"; flow: AutomationSummary }
  | { type: "rename"; flow: AutomationSummary }
  | null;

interface UseAutomationActionsParams {
  onFlowDeleted: (flowId: string) => void;
  onFlowRenamed: (updated: AutomationSummary) => void;
}

/**
 * useAutomationActions — encapsula las acciones disponibles sobre un flow.
 *
 * Responsabilidad única: gestionar estado modal + llamadas a servicios.
 * No contiene JSX ni lógica de presentación.
 */
export function useAutomationActions({ onFlowDeleted, onFlowRenamed }: UseAutomationActionsParams) {
  const navigate = useNavigate();
  const [modal, setModal] = useState<AutomationActionModal>(null);
  const [busy, setBusy] = useState(false);

  const openFlow = useCallback((flow: AutomationSummary) => {
    navigate(`/builder/${flow.key}`);
  }, [navigate]);

  const requestDelete = useCallback((flow: AutomationSummary) => {
    setModal({ type: "delete", flow });
  }, []);

  const requestRename = useCallback((flow: AutomationSummary) => {
    setModal({ type: "rename", flow });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (modal?.type !== "delete") return;
    const flow = modal.flow;
    setBusy(true);
    try {
      await deleteAutomation(flow.id);
      onFlowDeleted(flow.id);
    } finally {
      setBusy(false);
      setModal(null);
    }
  }, [modal, onFlowDeleted]);

  const confirmRename = useCallback(async (newName: string) => {
    if (modal?.type !== "rename") return;
    const flow = modal.flow;
    setBusy(true);
    try {
      const updated = await renameAutomation(flow.id, newName);
      onFlowRenamed(updated);
    } finally {
      setBusy(false);
      setModal(null);
    }
  }, [modal, onFlowRenamed]);

  const cancelModal = useCallback(() => setModal(null), []);

  return { modal, busy, openFlow, requestDelete, requestRename, confirmDelete, confirmRename, cancelModal };
}
