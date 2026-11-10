import "./pixel-list.css";
import { useId, useState } from "react";
import type { PixelConnectionSummary } from "@contracts/PixelContracts";
import type { PixelConnections } from "@shared/pixel-connections/usePixelConnections";
import { ConnectionCard } from "@shared/ui/integration-kit/ConnectionCard";
import { ConnectionListNotice } from "@shared/ui/integration-kit/ConnectionListNotice";
import { MetaMark } from "@shared/ui/integration-kit/IntegrationMark";
import { formatDateTime } from "@shared/format/formatDate";
import { AdsIcons } from "../components/adsIcons";
import { PixelDialogs, type PixelDialog } from "./PixelDialogs";
import { PixelHero } from "./PixelHero";

/**
 * Meta Ads → Píxel: los píxeles de Meta que usa el bloque «Pixel» (API de
 * Conversiones). Sin píxeles, la portada con el recorrido de la conversión;
 * con píxeles, sus tarjetas y una más para conectar otro. Los datos llegan de
 * la página, que también los usa para la tarjeta de estado «Píxel».
 */
export function PixelSection({ pixels }: { readonly pixels: PixelConnections }) {
  const [dialog, setDialog] = useState<PixelDialog>(null);
  const connect = () => setDialog({ kind: "connect" });

  return (
    <>
      {pixels.status !== "ready" ? (
        <ConnectionListNotice status={pixels.status} title="Píxeles de Meta" noun="tus píxeles" onRetry={pixels.refresh} />
      ) : pixels.connections.length === 0 ? (
        <PixelHero onConnect={connect} />
      ) : (
        <PixelList connections={pixels.connections} onVerify={pixels.verify} onConnect={connect} onOpen={setDialog} />
      )}
      <PixelDialogs dialog={dialog} pixels={pixels} onClose={() => setDialog(null)} />
    </>
  );
}

function PixelList({
  connections,
  onVerify,
  onConnect,
  onOpen
}: {
  readonly connections: ReadonlyArray<PixelConnectionSummary>;
  readonly onVerify: (id: string) => Promise<unknown>;
  readonly onConnect: () => void;
  readonly onOpen: (dialog: PixelDialog) => void;
}) {
  const addId = useId();

  return (
    <section className="pixel-list" aria-labelledby="pixel-list-title">
      <header className="pixel-list__head">
        <h2 id="pixel-list-title" className="pixel-list__title">
          Tus píxeles
        </h2>
        <p className="pixel-list__hint">El bloque «Pixel» de tus flujos les envía cada Lead y cada Compra.</p>
      </header>

      <div className="ai-grid">
        {connections.map((connection) => (
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
            activeLabel="Activo"
            invalidLabel="Token rechazado"
            replaceLabel="Cambiar token"
            onVerify={() => onVerify(connection.id)}
            onRename={() => onOpen({ kind: "rename", connection })}
            onReplaceSecret={() => onOpen({ kind: "secret", connection })}
            onDelete={() => onOpen({ kind: "delete", connection })}
          />
        ))}

        <button type="button" className="pixel-add" onClick={onConnect} aria-labelledby={`${addId}-label`} aria-describedby={`${addId}-hint`}>
          <span className="pixel-add__plus" aria-hidden="true">
            {AdsIcons.plus}
          </span>
          <span className="pixel-add__label" id={`${addId}-label`}>
            Conectar otro píxel
          </span>
          <span className="pixel-add__hint" id={`${addId}-hint`}>
            Para otra marca, tienda o cuenta publicitaria
          </span>
        </button>
      </div>
    </section>
  );
}
