import "./meta-accounts.css";
import { useState } from "react";
import { MetaMark } from "@shared/ui/integration-kit/IntegrationMark";
import { ConfirmDialog } from "@shared/ui/dialog/ConfirmDialog";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { timeAgo } from "@shared/format/timeAgo";
import type { useAdAccounts } from "@shared/ads/useAdAccounts";

const DATE = new Intl.DateTimeFormat("es", { day: "numeric", month: "long" });

/** Meta conectado: quién conectó, si hay que reconectar, y cada cuenta publicitaria con su interruptor. */
export function MetaAccountsList({ ads, onReconnect }: { readonly ads: ReturnType<typeof useAdAccounts>; readonly onReconnect: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const data = ads.data!;
  const run = (work: Promise<unknown>) => void work.catch((e) => setError(apiErrorMessage(e, "No se pudo completar.")));
  const { connection } = data;

  return (
    <section className="meta-accounts" aria-label="Cuentas publicitarias">
      <header className="meta-accounts__header">
        <MetaMark size="md" />
        <div>
          <h2>Meta conectado</h2>
          <p className="ui-muted">
            {connection.userName ? `Como ${connection.userName}` : "Conectado"} · {connection.method === "token" ? "con token" : "con inicio de sesión"}
            {connection.expiresAt ? ` · el permiso vence el ${DATE.format(new Date(connection.expiresAt))}` : ""}
          </p>
        </div>
        {data.canManage ? <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setConfirming(true)}>Desconectar</button> : null}
      </header>
      {connection.needsReconnect ? (
        <div className="meta-accounts__warn" role="alert">
          <span>{connection.lastError ?? "El permiso de Meta vence pronto. Vuelve a conectar para que el gasto siga llegando."}</span>
          {data.canManage ? <button type="button" className="ui-btn ui-btn--primary" onClick={onReconnect}>Volver a conectar</button> : null}
        </div>
      ) : null}
      <ul className="meta-accounts__list">
        {data.accounts.map((account) => (
          <li key={account.id} className={`meta-accounts__row${account.enabled ? " meta-accounts__row--on" : ""}`}>
            <span className="meta-accounts__info">
              <strong>{account.name}</strong>
              <span className="ui-muted">{account.externalId.replace("act_", "Cuenta ")} · {account.currency} · {account.timezone}{account.active ? "" : " · deshabilitada en Meta"}</span>
              <span className={account.lastError ? "meta-accounts__error" : "ui-muted"}>
                {account.lastError ?? (account.enabled ? (account.lastSyncedAt ? `Actualizada ${timeAgo(account.lastSyncedAt)}` : "Trayendo los últimos 2 meses…") : "Auream no la usa")}
              </span>
            </span>
            {data.canManage && account.enabled ? <button type="button" className="ui-btn ui-btn--ghost" onClick={() => run(ads.sync(account.id))}>Actualizar ahora</button> : null}
            <label className="meta-accounts__switch">
              <input type="checkbox" role="switch" checked={account.enabled} disabled={!data.canManage} onChange={(event) => run(ads.setEnabled(account.id, event.target.checked))} />
              <span>{account.enabled ? "En Auream" : "Usar"}</span>
            </label>
          </li>
        ))}
      </ul>
      {error ? <p className="ui-error" role="alert">{error}</p> : null}
      {confirming ? (
        <ConfirmDialog
          title="¿Desconectar Meta?"
          message="Auream deja de traer el gasto y borra el que ya tenía de estas cuentas. Tus ventas y su anuncio de origen quedan."
          confirmLabel="Desconectar"
          onConfirm={() => ads.disconnect()}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </section>
  );
}
