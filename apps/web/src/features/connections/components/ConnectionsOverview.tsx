import type { ConnectionStatus, ConnectionSummary } from "@contracts/ConnectionContracts";

// Resumen de un vistazo: cuántos números están listos, por vincular o caídos.

const TILES: ReadonlyArray<{ readonly key: string; readonly label: string; readonly statuses: ReadonlyArray<ConnectionStatus> }> = [
  { key: "connected", label: "Conectadas", statuses: ["connected"] },
  { key: "pending", label: "Por vincular", statuses: ["pending", "connecting"] },
  { key: "disconnected", label: "Desconectadas", statuses: ["disconnected"] }
];

export function ConnectionsOverview({ connections }: { readonly connections: ReadonlyArray<ConnectionSummary> }) {
  return (
    <ul className="wa-overview" aria-label="Resumen de conexiones">
      {TILES.map((tile) => {
        const count = connections.filter((connection) => tile.statuses.includes(connection.status)).length;
        return (
          <li key={tile.key} className={`wa-overview__tile wa-overview__tile--${tile.key}`}>
            <span className="wa-overview__count">{count}</span>
            <span className="wa-overview__label">{tile.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
