import "./pipeline-tab.css";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { DealCard, PipelineSummary } from "@contracts/CrmContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { RetryButton, StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { BoardToolbar, type BoardView as View, type OwnerFilter } from "./BoardToolbar";
import { BoardView } from "./BoardView";
import { ListView } from "./ListView";
import { LostReasonDialog } from "./LostReasonDialog";
import { PipelineStats } from "./PipelineStats";
import { useBoard } from "./useBoard";

/**
 * Un embudo: sus números, la barra (Tablero o Lista, de quién, buscar) y el
 * tablero o la lista. Pasar a alguien a «no compró» pregunta por qué. La
 * vista y la etapa de la lista viajan en la dirección (`?view=list&stage=…`).
 */
export function PipelineTab({ pipeline, canWrite, refreshKey, onOpen, onChanged }: {
  readonly pipeline: PipelineSummary;
  readonly canWrite: boolean;
  readonly refreshKey: number;
  readonly onOpen: (contactId: string) => void;
  readonly onChanged: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const view: View = params.get("view") === "list" ? "list" : "board";
  const stageId = pipeline.stages.find((stage) => stage.id === params.get("stage"))?.id ?? pipeline.stages[0]?.id ?? "";
  const [owner, setOwner] = useState<OwnerFilter>("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [lost, setLost] = useState<{ card: DealCard; stageId: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filters = { ...(owner ? { owner } : {}), ...(debounced.trim().length >= 2 ? { search: debounced.trim() } : {}) };
  const board = useBoard(pipeline.id, filters, refreshKey);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const setParam = (changes: Record<string, string | null>) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) if (value === null) next.delete(key); else next.set(key, value);
      return next;
    }, { replace: true });

  const move = async (card: DealCard, to: string, reason?: string) => {
    setError(null);
    const failure = await board.move(card, to, reason);
    if (failure) setError(apiErrorMessage(failure, "No se pudo mover al cliente."));
    else onChanged();
  };
  const requestMove = (card: DealCard, to: string) => {
    const stage = pipeline.stages.find((candidate) => candidate.id === to);
    if (stage?.outcome === "lost") setLost({ card, stageId: to, name: stage.name });
    else void move(card, to);
  };

  if (board.status === "error" && !board.board) {
    return (
      <StateCard role="alert" tone="warning" icon={StateIcons.offline} title="No pudimos cargar el embudo" description="Parece un problema de conexión momentáneo. Vuelve a intentarlo en unos segundos." actions={<RetryButton busy={false} onRetry={() => void board.reload()} />} />
    );
  }
  if (!board.board) return <div className="pipeline-tab__loading" aria-busy="true" aria-label="Cargando el embudo" />;

  return (
    <div className="pipeline-tab">
      <PipelineStats metrics={board.board.metrics} />
      <BoardToolbar view={view} owner={owner} search={search} onView={(next) => setParam({ view: next === "list" ? "list" : null })} onOwner={setOwner} onSearch={setSearch} />
      {error ? <p className="ui-error" role="alert">{error}</p> : null}
      {view === "board" ? (
        <BoardView board={board.board} stages={pipeline.stages} canWrite={canWrite} onOpen={(card) => onOpen(card.contactId)} onMove={requestMove} onShowStage={(id) => setParam({ view: "list", stage: id })} />
      ) : (
        <ListView
          pipelineId={pipeline.id}
          board={board.board}
          stages={pipeline.stages}
          stageId={stageId}
          filters={filters}
          refreshKey={refreshKey}
          canWrite={canWrite}
          onSelectStage={(id) => setParam({ stage: id })}
          onOpen={(card) => onOpen(card.contactId)}
          onMove={requestMove}
        />
      )}
      {lost ? (
        <LostReasonDialog
          stageName={lost.name}
          onClose={() => setLost(null)}
          onConfirm={(reason) => {
            const target = lost;
            setLost(null);
            void move(target.card, target.stageId, reason);
          }}
        />
      ) : null}
    </div>
  );
}
