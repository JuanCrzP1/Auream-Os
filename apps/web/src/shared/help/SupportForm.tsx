import "./support-form.css";
import { useRef, useState } from "react";
import { SUPPORT_TOPICS, type SupportCase, type SupportSettings, type SupportTopic } from "@contracts/HelpContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { uploadMedia } from "@shared/media/uploadMedia";
import { timeAgo } from "@shared/format/timeAgo";
import { helpApi } from "./helpApi";
import { whatsappLink } from "./moduleForPath";

const STATUS: Readonly<Record<SupportCase["status"], string>> = { open: "Abierto", answered: "Respondido", closed: "Cerrado" };

/** Hablar con soporte: WhatsApp (si está configurado) o abrir un caso con captura; y mis casos con su respuesta. */
export function SupportForm({ settings, cases, page, articleSlug, onCases }: {
  readonly settings: SupportSettings | null;
  readonly cases: ReadonlyArray<SupportCase>;
  readonly page: string;
  readonly articleSlug?: string | null;
  readonly onCases: (cases: ReadonlyArray<SupportCase>) => void;
}) {
  const [topic, setTopic] = useState<SupportTopic>("Otro");
  const [message, setMessage] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [state, setState] = useState<{ kind: "idle" | "busy" | "sent" | "error"; text?: string }>({ kind: "idle" });
  const file = useRef<HTMLInputElement>(null);

  const attach = async (picked: File | undefined) => {
    if (!picked) return;
    setState({ kind: "busy", text: "Subiendo la captura…" });
    try {
      setShot((await uploadMedia(picked, "image")).url);
      setState({ kind: "idle" });
    } catch (error) {
      setState({ kind: "error", text: apiErrorMessage(error, "No se pudo subir la captura.") });
    }
  };

  const send = async () => {
    setState({ kind: "busy" });
    try {
      onCases(await helpApi.openCase({ topic, message, page, screenshotUrl: shot, articleSlug: articleSlug ?? null }));
      setMessage("");
      setShot(null);
      setState({ kind: "sent", text: "Recibimos tu caso. Te respondemos aquí mismo." });
    } catch (error) {
      setState({ kind: "error", text: apiErrorMessage(error, "No se pudo enviar.") });
    }
  };

  return (
    <div className="support-form">
      {settings?.whatsapp || settings?.responseTime ? (
        <span className="support-form__online"><span aria-hidden="true" />{settings?.responseTime ? `Respondemos en ${settings.responseTime}` : "Soporte en línea"}{settings?.hours ? ` · ${settings.hours}` : ""}</span>
      ) : null}
      {settings?.whatsapp ? <a className="support-form__whatsapp" href={whatsappLink(settings.whatsapp, page)} target="_blank" rel="noreferrer">Escribir por WhatsApp →</a> : null}
      <section className="support-form__case" aria-label="Abrir un caso">
        <strong>{settings?.whatsapp ? "O abre un caso" : "Abre un caso"}</strong>
        <div className="support-form__topics" role="group" aria-label="Sobre qué es">
          {SUPPORT_TOPICS.map((item) => (
            <button key={item} type="button" aria-pressed={topic === item} onClick={() => setTopic(item)}>{item}</button>
          ))}
        </div>
        <textarea className="ui-input" rows={4} maxLength={4000} value={message} aria-label="Cuéntanos qué pasa" placeholder="Cuéntanos qué pasa y qué esperabas que pasara." onChange={(event) => setMessage(event.target.value)} />
        <div className="support-form__row">
          <button type="button" className="support-form__attach" onClick={() => (shot ? setShot(null) : file.current?.click())}>{shot ? "✓ Captura adjunta · quitar" : "Adjuntar una captura"}</button>
          <input ref={file} type="file" accept="image/*" hidden onChange={(event) => void attach(event.target.files?.[0])} />
        </div>
        <span className="support-form__note">Incluimos la pantalla en la que estás y tu cuenta, para que no tengas que explicarlo.</span>
        {state.text ? <span className={state.kind === "error" ? "ui-error" : "support-form__ok"} role="status">{state.text}</span> : null}
        <button type="button" className="ui-btn ui-btn--primary" disabled={message.trim().length < 5 || state.kind === "busy"} onClick={() => void send()}>
          {state.kind === "busy" ? "Enviando…" : "Enviar a soporte"}
        </button>
      </section>
      {settings?.email ? <span className="support-form__note">También por correo: <a href={`mailto:${settings.email}`}>{settings.email}</a></span> : null}
      {cases.length > 0 ? (
        <section className="support-form__cases" aria-label="Tus casos">
          <strong>Tus casos</strong>
          {cases.map((item) => (
            <article key={item.id} className="support-form__item">
              <span className="support-form__item-head"><span>{item.topic} · {timeAgo(item.createdAt)}</span><span className={`support-form__status support-form__status--${item.status}`}>{STATUS[item.status]}</span></span>
              <p>{item.message}</p>
              {item.reply ? <p className="support-form__reply"><strong>Soporte:</strong> {item.reply}</p> : null}
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
