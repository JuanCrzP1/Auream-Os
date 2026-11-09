import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import { ConfirmDialog } from "@shared/ui/dialog/ConfirmDialog";

// Las acciones de una conexión que piden confirmación, con lo que pasa en
// cada caso dicho claro (como en Leona).

export function DisconnectConnectionDialog({ connection, onConfirm, onClose }: { readonly connection: ConnectionSummary; readonly onConfirm: () => Promise<void>; readonly onClose: () => void }) {
  return (
    <ConfirmDialog
      title={`¿Desconectar «${connection.name}»?`}
      message="Se cierra la sesión de WhatsApp de este número: deja de recibir y enviar mensajes y los flujos no responden por él. La conexión, sus disparadores y sus chats se conservan; para volver a usarla, «Reconectar» y escanea el código QR."
      confirmLabel="Desconectar"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}

export function DeleteConnectionDialog({ connection, onConfirm, onClose }: { readonly connection: ConnectionSummary; readonly onConfirm: () => Promise<void>; readonly onClose: () => void }) {
  return (
    <ConfirmDialog
      title={`¿Eliminar «${connection.name}»?`}
      message="Se cierra la sesión de WhatsApp de este número en Auream, se borran sus disparadores y los flujos dejarán de responder por él. El historial de sus chats se conserva en Conversaciones para consultarlo."
      confirmLabel="Eliminar conexión"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
