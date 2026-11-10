import type { PixelConnectionSummary } from "@contracts/PixelContracts";
import type { PixelConnections } from "@shared/pixel-connections/usePixelConnections";
import { ConfirmDialog } from "@shared/ui/dialog/ConfirmDialog";
import { EditConnectionDialog } from "@shared/ui/integration-kit/EditConnectionDialog";
import { ConnectPixelDialog } from "./ConnectPixelDialog";

/** El diálogo abierto en la sección Píxel, si hay uno. */
export type PixelDialog =
  | { readonly kind: "connect" }
  | { readonly kind: "rename" | "secret" | "delete"; readonly connection: PixelConnectionSummary }
  | null;

/** Los diálogos del Píxel: conectar uno, renombrarlo, cambiar su token y eliminarlo. */
export function PixelDialogs({
  dialog,
  pixels,
  onClose
}: {
  readonly dialog: PixelDialog;
  readonly pixels: PixelConnections;
  readonly onClose: () => void;
}) {
  if (dialog === null) return null;
  if (dialog.kind === "connect") return <ConnectPixelDialog onConnect={pixels.create} onClose={onClose} />;

  const { connection } = dialog;
  if (dialog.kind === "delete") {
    return (
      <ConfirmDialog
        title={`¿Eliminar «${connection.name}»?`}
        message="El token se borra de Auream. Los bloques Pixel que lo usan dejarán de registrar conversiones hasta que elijas otro."
        confirmLabel="Eliminar píxel"
        onConfirm={() => pixels.remove(connection.id)}
        onClose={onClose}
      />
    );
  }

  const mode = dialog.kind;
  return (
    <EditConnectionDialog
      name={connection.name}
      mode={mode}
      secretLabel="el token"
      secretFieldLabel="Nuevo token de la API de Conversiones"
      secretPlaceholder="EAAG…"
      secretHint="Los bloques Pixel que usan esta conexión empiezan a usar el token nuevo al instante."
      minSecretLength={30}
      onSave={(value) => pixels.update(connection.id, mode === "rename" ? { name: value } : { accessToken: value })}
      onClose={onClose}
    />
  );
}
