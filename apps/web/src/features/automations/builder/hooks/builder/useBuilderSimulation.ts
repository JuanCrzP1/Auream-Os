import { useState } from "react";
import { simulateBuilderWorkspace } from "@features/automations/builder/services/simulateBuilderWorkspace";

export interface SimulationMessage {
  id: string;
  role: "user" | "bot";
  content: string;
}

export type SimulationStatus = "idle" | "running" | "error";

interface UseBuilderSimulationParams {
  flowKey: string;
}

/**
 * useBuilderSimulation — responsabilidad única: simulación de flujos en el builder.
 *
 * Gestiona el log de mensajes y el estado de la simulación.
 * No tiene conocimiento del canvas ni del autosave ni de la publicación.
 */
export function useBuilderSimulation({ flowKey }: UseBuilderSimulationParams) {
  const [simulationLog, setSimulationLog] = useState<SimulationMessage[]>([]);
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus>("idle");

  async function handleSimulate(message: string): Promise<void> {
    setSimulationStatus("running");
    setSimulationLog((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", content: message }
    ]);

    try {
      const result = await simulateBuilderWorkspace(
        flowKey,
        message,
        "builder-simulation-001",
        "builder-user"
      );

      setSimulationLog((current) => [
        ...current,
        ...result.outputMessages.map((output, index) => ({
          id: `bot-${Date.now()}-${index}`,
          role: "bot" as const,
          // Un aviso al equipo (Notificación) no lo ve el cliente: se marca como tal.
          content: output.recipient ? `🔔 Aviso a ${output.recipient.name} (+${output.recipient.phone}): ${output.content}` : output.content
        }))
      ]);
      setSimulationStatus("idle");
    } catch {
      setSimulationStatus("error");
    }
  }

  function resetSimulation(): void {
    setSimulationLog([]);
    setSimulationStatus("idle");
  }

  return { simulationLog, simulationStatus, handleSimulate, resetSimulation };
}
