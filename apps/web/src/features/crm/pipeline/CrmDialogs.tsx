import { useState } from "react";
import type { PipelineSummary, SavePipelineRequest } from "@contracts/CrmContracts";
import type { ProductSummary } from "@contracts/SalesContracts";
import { ConfirmDialog } from "@shared/ui/dialog/ConfirmDialog";
import { crmApi } from "../services/crmApi";
import { AddClientDialog } from "./AddClientDialog";
import { ImportClientsDialog } from "./ImportClientsDialog";
import { PipelineSettingsDialog } from "./PipelineSettingsDialog";

export type CrmDialog =
  | { readonly kind: "settings"; readonly pipeline: PipelineSummary | null }
  | { readonly kind: "add"; readonly pipeline: PipelineSummary }
  | { readonly kind: "import"; readonly pipeline: PipelineSummary; readonly justCreated?: boolean }
  | null;

/**
 * Los diálogos del embudo: configurar o crear, quitar (con confirmación),
 * agregar un cliente y traer a los que ya tienes (se ofrece solo al crear un
 * embudo que deja entrar clientes).
 */
export function CrmDialogs({ dialog, products, onSave, onRemove, onSaved, onClose }: {
  readonly dialog: CrmDialog;
  readonly products: ReadonlyArray<ProductSummary>;
  readonly onSave: (pipelineId: string | null, request: SavePipelineRequest) => Promise<PipelineSummary>;
  readonly onRemove: (pipelineId: string) => Promise<void>;
  /** Se guardó (con el id del embudo a mostrar) o se movió a alguien. */
  readonly onSaved: (pipelineId: string | null) => void;
  readonly onClose: () => void;
}) {
  const [removing, setRemoving] = useState<PipelineSummary | null>(null);
  const [offerImport, setOfferImport] = useState<PipelineSummary | null>(null);

  if (offerImport) {
    return <ImportClientsDialog pipeline={offerImport} justCreated onDone={() => onSaved(offerImport.id)} onClose={() => setOfferImport(null)} />;
  }
  if (dialog?.kind === "import") {
    return <ImportClientsDialog pipeline={dialog.pipeline} justCreated={dialog.justCreated ?? false} onDone={() => onSaved(dialog.pipeline.id)} onClose={onClose} />;
  }

  if (removing) {
    return (
      <ConfirmDialog
        title={`¿Quitar el embudo «${removing.name}»?`}
        message="Sus etapas dejan de ser un embudo, pero las etiquetas y los clientes quedan como están. El valor y el historial de este embudo se pierden."
        confirmLabel="Quitar embudo"
        onConfirm={async () => {
          await onRemove(removing.id);
          setRemoving(null);
          onClose();
          onSaved(null);
        }}
        onClose={() => setRemoving(null)}
      />
    );
  }
  if (dialog?.kind === "settings") {
    const { pipeline } = dialog;
    return (
      <PipelineSettingsDialog
        pipeline={pipeline}
        products={products}
        onSave={async (request) => {
          const saved = await onSave(pipeline?.id ?? null, request);
          onSaved(saved.id);
          if (!pipeline && saved.entryStageId) setOfferImport(saved);
        }}
        onDelete={pipeline ? () => setRemoving(pipeline) : null}
        onClose={onClose}
      />
    );
  }
  if (dialog?.kind === "add") {
    return (
      <AddClientDialog
        stages={dialog.pipeline.stages}
        onAdd={async (contactId, stageId) => {
          await crmApi.move(dialog.pipeline.id, contactId, { stageId });
          onSaved(dialog.pipeline.id);
        }}
        onClose={onClose}
      />
    );
  }
  return null;
}
