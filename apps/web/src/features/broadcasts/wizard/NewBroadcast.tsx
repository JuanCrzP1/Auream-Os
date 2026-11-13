import "./new-broadcast.css";
import { useEffect, useState } from "react";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { broadcastsApi } from "../services/broadcastsApi";
import { count } from "../broadcastFormat";
import { AudienceStep } from "./AudienceStep";
import { EMPTY_DRAFT, STEPS, stepProblem, toRequest, type BroadcastDraft } from "./broadcastDraft";
import { canBroadcast } from "./numbers";
import { ContentStep } from "./ContentStep";
import { PhonePreview } from "./PhonePreview";
import { ReachCard } from "./ReachCard";
import { ReviewStep } from "./ReviewStep";
import { SendingStep } from "./SendingStep";
import { useAudiencePreview } from "./useAudiencePreview";
import { useWizardData } from "./useWizardData";

/**
 * Nueva difusión en 4 pasos (qué, a quién, por cuál número y cuándo, revisar).
 * A un lado, siempre: a cuántos les llega y cómo lo ve el cliente.
 */
export function NewBroadcast({ onClose, onCreated }: { readonly onClose: () => void; readonly onCreated: (id: string) => void }) {
  const data = useWizardData();
  const [draft, setDraft] = useState<BroadcastDraft>(EMPTY_DRAFT);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (patch: Partial<BroadcastDraft>) => setDraft((current) => ({ ...current, ...patch }));

  // Arranca con los números que pueden enviar ya elegidos.
  useEffect(() => {
    if (data.ready && draft.connectionIds.length === 0) update({ connectionIds: data.connections.filter(canBroadcast).map((c) => c.id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.ready]);

  const { preview, loading } = useAudiencePreview(draft.audience, draft.connectionIds, draft.settings.dailyCap);
  const reach = loading || !preview ? null : preview.count;
  const problem = stepProblem(draft, step, reach);
  const last = step === STEPS.length - 1;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await broadcastsApi.create(toRequest(draft));
      onCreated(created.id);
    } catch (failure) {
      setError(apiErrorMessage(failure, "No se pudo crear la difusión."));
      setBusy(false);
    }
  };

  return (
    <div className="ui-page ui-page--content bc-new">
      <header className="bc-new__header">
        <div className="bc-new__title">
          <button type="button" className="bc-new__back" onClick={onClose} aria-label="Volver a Difusiones">←</button>
          <div>
            <h1 className="ui-page__title">Nueva difusión</h1>
            <p className="ui-page__subtitle">Solo a quien ya te escribió, con un ritmo que cuida tu número.</p>
          </div>
        </div>
        <ol className="bc-new__steps" aria-label="Pasos">
          {STEPS.map((label, index) => (
            <li key={label}>
              <button type="button" className="bc-new__step" aria-current={index === step ? "step" : undefined} disabled={index > step && Boolean(stepProblem(draft, step, reach))} onClick={() => setStep(index)}>
                <span className={`bc-new__dot${index <= step ? " bc-new__dot--on" : ""}`}>{index < step ? "✓" : index + 1}</span>
                {label}
              </button>
            </li>
          ))}
        </ol>
      </header>

      <div className="bc-new__body">
        <section className="bc-new__card" aria-label={STEPS[step]}>
          {step === 0 ? <ContentStep draft={draft} update={update} flows={data.flows} connections={data.connections} /> : null}
          {step === 1 ? <AudienceStep draft={draft} update={update} data={data} /> : null}
          {step === 2 ? <SendingStep draft={draft} update={update} connections={data.connections} preview={preview} /> : null}
          {step === 3 ? <ReviewStep draft={draft} update={update} flows={data.flows} connections={data.connections} reach={reach} /> : null}

          {error ? <p className="ui-error" role="alert">{error}</p> : null}
          <footer className="bc-new__footer">
            <button type="button" className="ui-btn ui-btn--ghost" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>
              {step === 0 ? "Cancelar" : "Atrás"}
            </button>
            <span className="bc-new__problem">{problem}</span>
            {last ? (
              <button type="button" className="ui-btn ui-btn--primary bc-new__send" disabled={Boolean(problem) || busy || reach === null} onClick={() => void submit()}>
                {busy ? "Creando…" : reach === null ? "Contando a cuántos les llega…" : `${draft.scheduledAt ? "Programar para" : "Enviar a"} ${count(reach)} ${reach === 1 ? "persona" : "personas"}`}
              </button>
            ) : (
              <button type="button" className="ui-btn ui-btn--primary" disabled={Boolean(problem)} onClick={() => setStep(step + 1)}>
                Siguiente
              </button>
            )}
          </footer>
        </section>

        <aside className="bc-new__aside">
          <ReachCard preview={preview} loading={loading} hasNumbers={draft.connectionIds.length > 0} />
          <PhonePreview draft={draft} flows={data.flows} sampleName={preview?.sample.find((person) => person.name)?.name ?? null} />
        </aside>
      </div>
    </div>
  );
}
