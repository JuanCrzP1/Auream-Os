import { useState } from "react";
import type { PixelConnectionSummary } from "@contracts/PixelContracts";
import { usePixelConnections } from "@shared/pixel-connections/usePixelConnections";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { ConnectionCard } from "@shared/ui/integration-kit/ConnectionCard";
import { ConnectPixelDialog } from "./ConnectPixelDialog";
import { EditConnectionDialog } from "@shared/ui/integration-kit/EditConnectionDialog";
import { ConfirmDialog } from "@shared/ui/dialog/ConfirmDialog";
import { MetaMark } from "@shared/ui/integration-kit/IntegrationMark";
import { IntegrationSection } from "@shared/ui/integration-kit/IntegrationSection";
import { formatDateTime } from "@shared/format/formatDate";

type Dialog = { readonly kind: "connect" } | { readonly kind: "rename" | "secret" | "delete"; readonly connection: PixelConnectionSummary } | null;

/** Meta Ads → Píxel: los píxeles de Meta que usa el bloque «Pixel» (API de Conversiones). */
export function PixelSection() {
  const pixels = usePixelConnections();
  const [dialog, setDialog] = useState<Dialog>(null);

  return (
    <IntegrationSection
      id="pixels"
      title="Píxeles de Meta"
      noun="tus píxeles"
      description="Los usa el bloque «Pixel» para registrar Leads y Compras en tus campañas de Facebook e Instagram."
      status={pixels.status}
      onRetry={pixels.refresh}
      count={pixels.connections.length}
      connectLabel="Conectar píxel"
      onConnect={() => setDialog({ kind: "connect" })}
      empty={{
        icon: StateIcons.target,
        title: "Conecta tu píxel de Meta",
        description: "Con el ID del píxel y un token de la API de Conversiones, tus flujos registran cada Lead y cada Compra, también de anuncios de clic a WhatsApp."
      }}
      dialogs={
        <>
          {dialog?.kind === "connect" ? <ConnectPixelDialog onConnect={pixels.create} onClose={() => setDialog(null)} /> : null}
          {dialog?.kind === "rename" || dialog?.kind === "secret" ? (
            <EditConnectionDialog
              name={dialog.connection.name}
              mode={dialog.kind}
              secretLabel="el token"
              secretFieldLabel="Nuevo token de la API de Conversiones"
              secretPlaceholder="EAAG…"
              secretHint="Los bloques Pixel que usan esta conexión empiezan a usar el token nuevo al instante."
              minSecretLength={30}
              onSave={(value) => pixels.update(dialog.connection.id, dialog.kind === "rename" ? { name: value } : { accessToken: value })}
              onClose={() => setDialog(null)}
            />
          ) : null}
          {dialog?.kind === "delete" ? (
            <ConfirmDialog
              title={`¿Eliminar «${dialog.connection.name}»?`}
              message="El token se borra de Auream. Los bloques Pixel que lo usan dejarán de registrar conversiones hasta que elijas otro."
              confirmLabel="Eliminar píxel"
              onConfirm={() => pixels.remove(dialog.connection.id)}
              onClose={() => setDialog(null)}
            />
          ) : null}
        </>
      }
    >
      {pixels.connections.map((connection) => (
        <ConnectionCard
          key={connection.id}
          mark={<MetaMark />}
          name={connection.name}
          subtitle={`Píxel ${connection.pixelId}`}
          active={connection.status === "active"}
          facts={[
            { label: "Token", value: connection.tokenHint, mono: true },
            { label: "Verificado", value: connection.lastVerifiedAt ? formatDateTime(connection.lastVerifiedAt) : "Nunca" }
          ]}
          invalidWarning="Meta ya no acepta este token: los bloques Pixel no están registrando conversiones. Cámbialo por uno nuevo."
          invalidLabel="Token rechazado"
          replaceLabel="Cambiar token"
          onVerify={() => pixels.verify(connection.id)}
          onRename={() => setDialog({ kind: "rename", connection })}
          onReplaceSecret={() => setDialog({ kind: "secret", connection })}
          onDelete={() => setDialog({ kind: "delete", connection })}
        />
      ))}
    </IntegrationSection>
  );
}
