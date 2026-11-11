import "./article-feedback.css";
import { useState } from "react";
import { helpApi } from "@shared/help/helpApi";
import { HelpIcon } from "@shared/help/HelpIcons";

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
          <span className="help-feedback__text">
            <strong>¿Te sirvió este artículo?</strong>
            <span>Tu respuesta nos dice qué mejorar.</span>
          </span>
          <span className="help-feedback__buttons">
            <button type="button" onClick={() => rate(true)}><HelpIcon name="thumbUp" />Sí</button>
            <button type="button" onClick={() => rate(false)}><HelpIcon name="thumbDown" />No</button>
          </span>
        </>
      ) : answer || sent ? (
        <span className="help-feedback__thanks"><span><HelpIcon name="check" /></span>¡Gracias! Así mejoramos la ayuda.</span>
      ) : (
        <div className="help-feedback__more">
          <strong>Gracias. ¿Qué te faltó?</strong>
          <textarea className="ui-input" rows={3} maxLength={1000} value={comment} aria-label="Qué faltó" placeholder="Cuéntanos qué esperabas encontrar o qué no quedó claro." onChange={(event) => setComment(event.target.value)} />
          <button type="button" className="ui-btn" onClick={() => void helpApi.rate(slug, false, comment.trim() || null).then(() => setSent(true)).catch(() => undefined)}>Enviar</button>
        </div>
      )}
    </section>
  );
}
