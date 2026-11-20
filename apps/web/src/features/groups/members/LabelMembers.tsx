import "./label-members.css";
import { useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { GroupMemberFilter } from "@contracts/GroupMemberContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { count } from "../groupsFormat";
import { groupsApi } from "../services/groupsApi";

const SUFFIX: Readonly<Record<GroupMemberFilter, string>> = { all: "miembro", buyers: "compró", nonBuyers: "no compró", left: "salió", admins: "admin" };

type State =
  | { readonly kind: "closed" }
  | { readonly kind: "editing" }
  | { readonly kind: "working"; readonly done: number; readonly total: number }
  | { readonly kind: "finished"; readonly label: string; readonly done: number; readonly stopped: boolean }
  | { readonly kind: "failed"; readonly message: string };

/** La etiqueta que se propone: «Lanzamiento #3 – no compró» (hasta 40 caracteres). */
export function suggestedLabel(groupName: string, filter: GroupMemberFilter): string {
  const suffix = ` – ${SUFFIX[filter]}`;
  return `${groupName.slice(0, 40 - suffix.length).trim()}${suffix}`;
}

/**
 * «Ponerles una etiqueta» a los del filtro: va por tandas (la API dice cuántos
 * faltan) hasta terminar, se puede detener y nunca repite. Así quedan en el
 * CRM y en Difusiones, que envía con ritmo seguro (escribirles uno por uno
 * desde aquí pondría en riesgo tu número).
 */
export function LabelMembers({ groupId, groupName, filter, people, disabled, onLabeled }: {
  readonly groupId: string;
  readonly groupName: string;
  readonly filter: GroupMemberFilter;
  /** Cuántos hay en el filtro. */
  readonly people: number;
  /** Con una búsqueda escrita: la etiqueta es para todo el filtro, no para lo buscado. */
  readonly disabled: boolean;
  readonly onLabeled: () => void;
}) {
  const inputId = useId();
  const [state, setState] = useState<State>({ kind: "closed" });
  const [label, setLabel] = useState(() => suggestedLabel(groupName, filter));
  const stop = useRef(false);

  const open = () => {
    setLabel(suggestedLabel(groupName, filter));
    setState({ kind: "editing" });
  };

  const run = async () => {
    stop.current = false;
    let done = 0;
    // Se ve que trabaja desde el primer instante (la primera tanda tarda unos segundos).
    setState({ kind: "working", done: 0, total: people });
    try {
      let batch = await groupsApi.labelMembers(groupId, filter, label);
      done += batch.labeled;
      setState({ kind: "working", done, total: done + batch.remaining });
      while (batch.remaining > 0 && batch.labeled > 0 && !stop.current) {
        batch = await groupsApi.labelMembers(groupId, filter, label);
        done += batch.labeled;
        setState({ kind: "working", done, total: done + batch.remaining });
      }
      setState({ kind: "finished", label: batch.label, done, stopped: batch.remaining > 0 });
      onLabeled();
    } catch (cause) {
      setState({ kind: "failed", message: apiErrorMessage(cause, `No se pudo terminar. ${done > 0 ? `${count(done)} ya quedaron con la etiqueta; ` : ""}vuelve a intentarlo y seguirá donde quedó.`) });
    }
  };

  if (state.kind === "closed") {
    return (
      <button type="button" className="ui-btn gr-members__action" disabled={disabled || people === 0} title={disabled ? "Quita la búsqueda: la etiqueta es para todo el filtro." : undefined} onClick={open}>
        Ponerles una etiqueta
      </button>
    );
  }

  return (
    <div className="gr-members__label" role="group" aria-label="Ponerles una etiqueta">
      {state.kind === "editing" ? (
        <>
          <label htmlFor={inputId}>Etiqueta para los {count(people)} de este filtro</label>
          <div className="gr-members__label-row">
            <input id={inputId} className="ui-input" maxLength={40} value={label} onChange={(event) => setLabel(event.target.value)} />
            <button type="button" className="ui-btn ui-btn--primary" disabled={!label.trim()} onClick={() => void run()}>Etiquetar</button>
            <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setState({ kind: "closed" })}>Cancelar</button>
          </div>
          <p className="ui-muted">Quedan en el CRM y puedes usarlos en Difusiones o en un flujo. Nunca se etiqueta tu número ni dos veces a la misma persona.</p>
        </>
      ) : null}
      {state.kind === "working" ? (
        <div className="gr-members__label-row" role="status">
          <span>Etiquetando… {count(state.done)} de {count(state.total)}</span>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={() => (stop.current = true)}>Detener</button>
        </div>
      ) : null}
      {state.kind === "finished" ? (
        <div role="status">
          <p>
            {state.done === 0 ? `Todos ya tenían la etiqueta «${state.label}».` : `Listo: ${count(state.done)} ${state.done === 1 ? "persona" : "personas"} con la etiqueta «${state.label}».`}
            {state.stopped ? " Lo detuviste: al volver a etiquetar sigue con los que faltan." : ""}
          </p>
          <p className="ui-muted">Para escribirles, usa <Link className="ui-link" to="/broadcasts">Difusiones</Link>: envía con ritmo seguro y cuida tu número.</p>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setState({ kind: "closed" })}>Cerrar</button>
        </div>
      ) : null}
      {state.kind === "failed" ? (
        <div role="alert">
          <p className="ui-error">{state.message}</p>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setState({ kind: "editing" })}>Volver</button>
        </div>
      ) : null}
    </div>
  );
}
