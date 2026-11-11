import { useState } from "react";
import { helpApi } from "@shared/help/helpApi";

/** «¿Te sirvió?»: un toque, y si no sirvió, qué faltó (opcional). */
export function ArticleFeedback({ slug }: { readonly slug: string }) {
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const rate = (helpful: boolean) => {
    setAnswer(helpful);
    if (helpful) void helpApi.rate(slug, true, null).then(() => setSent(true)).catch(() => undefined);
  };
  return (
    <section className="help-feedback" aria-label="¿Te sirvió?">
      {answer === null ? (
        <>
          <strong>¿Te sirvió este artículo?</strong>
          <span className="help-feedback__buttons">
            <button type="button" onClick={() => rate(true)}>👍 Sí</button>
            <button type="button" onClick={() => rate(false)}>👎 No</button>
          </span>
        </>
      ) : answer || sent ? (
        <strong>¡Gracias! Nos ayuda a mejorar la ayuda.</strong>
      ) : (
        <div className="help-feedback__more">
          <strong>Gracias. ¿Qué faltó?</strong>
          <textarea className="ui-input" rows={2} maxLength={1000} value={comment} aria-label="Qué faltó" placeholder="Cuéntanos qué esperabas encontrar." onChange={(event) => setComment(event.target.value)} />
          <button type="button" className="ui-btn" onClick={() => void helpApi.rate(slug, false, comment.trim() || null).then(() => setSent(true)).catch(() => undefined)}>Enviar</button>
        </div>
      )}
    </section>
  );
}
