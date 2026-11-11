import { useState } from "react";
import { Link } from "react-router-dom";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { EmptyState } from "@shared/ui/empty-state/EmptyState";
import { groupsApi } from "../services/groupsApi";

const ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

/** Grupos sin campañas: qué es, crear la primera o traer los grupos que ya tienes. */
export function FirstGroups({ canManage, hasNumbers, onNew, onMine }: { readonly canManage: boolean; readonly hasNumbers: boolean; readonly onNew: () => void; readonly onMine: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bring = async () => {
    setBusy(true);
    setError(null);
    try {
      await groupsApi.sync();
      onMine();
    } catch (failure) {
      setError(apiErrorMessage(failure, "No se pudieron traer tus grupos."));
      setBusy(false);
    }
  };
  const actions = !canManage ? (
    <span className="ui-muted">Las campañas las crean los dueños y administradores.</span>
  ) : !hasNumbers ? (
    <Link className="ui-btn ui-btn--primary" to="/connections">Conectar un número</Link>
  ) : (
    <>
      <button type="button" className="ui-btn ui-btn--primary" onClick={onNew}>Crear campaña</button>
      <button type="button" className="ui-btn" disabled={busy} onClick={() => void bring()}>{busy ? "Trayendo…" : "Traer mis grupos"}</button>
      {error ? <span className="ui-error">{error}</span> : null}
    </>
  );
  return (
    <EmptyState
      icon={ICON}
      label="Tu primera campaña de grupos"
      title="Crea tu primera campaña de grupos"
      description={hasNumbers
        ? "Un enlace que lleva a tus grupos de WhatsApp, crea el siguiente cuando uno se llena y te muestra cuánto vende cada grupo."
        : "Los grupos se crean y se manejan por un número de WhatsApp conectado con QR. Conéctalo primero en Conexiones."}
      actions={actions}
      steps={["Comparte un enlace", "Los grupos se llenan y se crean solos", "Ves lo que vende cada grupo"]}
    />
  );
}
