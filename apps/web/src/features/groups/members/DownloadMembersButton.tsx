import { useState } from "react";
import { GROUP_MEMBERS_EXPORT_MAX, type GroupMemberFilter } from "@contracts/GroupMemberContracts";
import { saveFile } from "@shared/files/saveFile";
import { count } from "../groupsFormat";
import { groupsApi } from "../services/groupsApi";

type State = { readonly kind: "idle" } | { readonly kind: "busy" } | { readonly kind: "done"; readonly text: string } | { readonly kind: "failed" };

/**
 * Descargar los del filtro en un CSV (abre en Excel y Google Sheets). Solo
 * dueños y administradores; queda registrado quién lo descargó y cuándo.
 */
export function DownloadMembersButton({ groupId, filter, people, disabled = false }: {
  readonly groupId: string;
  readonly filter: GroupMemberFilter;
  readonly people: number;
  /** Con una búsqueda escrita: la descarga es de todo el filtro, no de lo buscado. */
  readonly disabled?: boolean;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });

  const download = async () => {
    setState({ kind: "busy" });
    try {
      const file = await groupsApi.exportMembers(groupId, filter);
      saveFile(file.blob, file.filename);
      setState({ kind: "done", text: file.truncated ? `Se descargaron los primeros ${count(GROUP_MEMBERS_EXPORT_MAX)}.` : `Listo: ${file.rows === 1 ? "1 persona" : `${count(file.rows)} personas`}.` });
    } catch {
      setState({ kind: "failed" });
    }
  };

  return (
    <span className="gr-members__download">
      <button type="button" className="ui-btn gr-members__action" disabled={disabled || state.kind === "busy" || people === 0} title={disabled ? "Quita la búsqueda: la descarga es de todo el filtro." : undefined} onClick={() => void download()}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 4v11M7 10.5 12 15.5l5-5M5 19.5h14" />
        </svg>
        {state.kind === "busy" ? "Preparando…" : "Descargar"}
      </button>
      <span className="ui-muted" role="status">{state.kind === "done" ? state.text : state.kind === "failed" ? "No se pudo descargar. Vuelve a intentarlo." : ""}</span>
    </span>
  );
}
