import { useEffect, useState } from "react";
import type { MetaDataDeletionStatus } from "@contracts/MetaDataDeletionContracts";
import { builderApiClient } from "@shared/http/builderApiClient";

type State = { readonly kind: "loading" } | { readonly kind: "found"; readonly status: MetaDataDeletionStatus } | { readonly kind: "missing" };

const DATE = new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * El estado de una solicitud de borrado hecha desde Facebook: Meta manda a la
 * persona aquí con su código (`?codigo=`). Sin datos personales: solo si se
 * completó, cuándo y qué se borró.
 */
export function DeletionStatus({ code }: { readonly code: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ kind: "loading" });
    builderApiClient
      .get<MetaDataDeletionStatus>(`/meta/data-deletion/${encodeURIComponent(code)}`)
      .then((status) => alive && setState({ kind: "found", status }))
      .catch(() => alive && setState({ kind: "missing" }));
    return () => {
      alive = false;
    };
  }, [code]);

  if (state.kind === "loading") return <p className="legal-status" aria-busy="true">Buscando tu solicitud…</p>;
  if (state.kind === "missing") {
    return (
      <p className="legal-status legal-status--missing" role="status">
        No encontramos una solicitud con el código <strong>{code}</strong>. Revisa que esté bien escrito o escríbenos.
      </p>
    );
  }
  const { status } = state;
  return (
    <section className="legal-status legal-status--done" aria-label="Estado de tu solicitud" role="status">
      <strong>Solicitud {status.code}: completada ✓</strong>
      <span>Recibida el {DATE.format(new Date(status.requestedAt))}.</span>
      <span>
        {status.deletedConnections > 0
          ? `Borramos el acceso a Meta Ads que diste con tu cuenta de Facebook (${status.deletedConnections === 1 ? "1 conexión" : `${status.deletedConnections} conexiones`}), con su token y sus cuentas publicitarias.`
          : "No teníamos datos de Meta ligados a tu cuenta de Facebook, así que no hubo nada que borrar."}
      </span>
    </section>
  );
}
