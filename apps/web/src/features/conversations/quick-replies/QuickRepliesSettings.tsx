import "./quick-replies-settings.css";
import { useMemo, useState } from "react";
import type { QuickReply, SaveQuickReplyRequest } from "@contracts/QuickReplyContracts";
import { useQuickReplies } from "@shared/quick-replies/useQuickReplies";
import { ConfirmDialog } from "@shared/ui/dialog/ConfirmDialog";
import { RetryButton, StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { QuickReplyEditor } from "./editor/QuickReplyEditor";
import { QuickReplyRow } from "./QuickReplyRow";
import { categoriesOf, copyShortcut, groupByCategory, matchQuickReplies } from "./quickReplyText";

type Dialog = { readonly kind: "edit"; readonly reply: QuickReply | null; readonly initial?: SaveQuickReplyRequest } | { readonly kind: "delete"; readonly reply: QuickReply } | null;

const byUse = (a: QuickReply, b: QuickReply) => b.useCount - a.useCount || a.shortcut.localeCompare(b.shortcut, "es");

/**
 * Configuración › Respuestas rápidas: el catálogo de la cuenta, por
 * categorías, con lo que envía cada una y cuánto la usa el equipo. Dueños y
 * administradores crean, editan, duplican y borran; el resto las ve (y las
 * usa en el chat).
 */
export function QuickRepliesSettings() {
  const catalog = useQuickReplies();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const categories = useMemo(() => categoriesOf(catalog.replies), [catalog.replies]);
  const groups = useMemo(() => groupByCategory(matchQuickReplies([...catalog.replies].sort(byUse), query)), [catalog.replies, query]);
  const visible = category ? groups.filter((group) => group.category === category) : groups;
  const create = () => setDialog({ kind: "edit", reply: null });

  if (catalog.status === "loading") return <div className="qr-settings__loading" aria-busy="true" aria-label="Cargando respuestas rápidas" />;
  if (catalog.status === "error") {
    return (
      <StateCard role="alert" tone="warning" icon={StateIcons.offline} title="No pudimos cargar las respuestas rápidas" description="Revisa tu conexión e inténtalo de nuevo." actions={<RetryButton busy={false} onRetry={() => void catalog.reload()} />} />
    );
  }

  return (
    <section className="qr-settings" aria-label="Respuestas rápidas">
      {catalog.replies.length === 0 ? (
        <StateCard
          icon={StateIcons.sparkles}
          title="Responde en segundos, sin copiar y pegar"
          description={catalog.canManage ? "Guarda los mensajes que tu equipo envía todos los días (saludo, precios, cómo pagar, envíos) con fotos, videos o documentos. En el chat se buscan escribiendo «/»." : "Aún no hay respuestas rápidas. Las crean los dueños y administradores de la cuenta."}
          actions={catalog.canManage ? <button type="button" className="ui-btn ui-btn--primary" onClick={create}>Crear la primera</button> : undefined}
        />
      ) : (
        <>
          <div className="qr-settings__bar">
            <input className="ui-input qr-settings__search" type="search" value={query} placeholder="Buscar por atajo, categoría o texto…" aria-label="Buscar respuestas rápidas" onChange={(event) => setQuery(event.target.value)} />
            {catalog.canManage ? <button type="button" className="ui-btn ui-btn--primary" onClick={create}>+ Nueva respuesta</button> : null}
          </div>
          {categories.length > 0 ? (
            <div className="qr-settings__filters" role="group" aria-label="Filtrar por categoría">
              <button type="button" className={`qr-chip${category === null ? " is-on" : ""}`} aria-pressed={category === null} onClick={() => setCategory(null)}>Todas · {catalog.replies.length}</button>
              {groupByCategory(catalog.replies).map((group) => (
                <button key={group.category} type="button" className={`qr-chip${category === group.category ? " is-on" : ""}`} aria-pressed={category === group.category} onClick={() => setCategory(category === group.category ? null : group.category)}>
                  {group.category} · {group.replies.length}
                </button>
              ))}
            </div>
          ) : null}
          {!catalog.canManage ? <p className="qr-settings__note">Solo los dueños y administradores las crean y editan. Tú las usas en el chat con «/».</p> : null}
          {visible.length === 0 ? <p className="qr-settings__note">Ninguna coincide con «{query}».</p> : null}
          {visible.map((group) => (
            <section key={group.category} className="qr-group" aria-label={group.category}>
              <h3 className="qr-group__title">{group.category} <span>{group.replies.length}</span></h3>
              <ul className="qr-group__list">
                {group.replies.map((reply) => (
                  <QuickReplyRow
                    key={reply.id}
                    reply={reply}
                    canManage={catalog.canManage}
                    onEdit={() => setDialog({ kind: "edit", reply })}
                    onDuplicate={() =>
                      setDialog({ kind: "edit", reply: null, initial: { shortcut: copyShortcut(reply.shortcut, catalog.replies.map((item) => item.shortcut)), category: reply.category, pieces: reply.pieces } })
                    }
                    onDelete={() => setDialog({ kind: "delete", reply })}
                  />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {dialog?.kind === "edit" ? (
        <QuickReplyEditor
          reply={dialog.reply}
          {...(dialog.initial ? { initial: dialog.initial } : {})}
          categories={categories}
          onSave={(request) => catalog.save(request, dialog.reply?.id)}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "delete" ? (
        <ConfirmDialog
          title={`¿Borrar /${dialog.reply.shortcut}?`}
          message="Nadie del equipo podrá volver a usarla en el chat. Los mensajes que ya se enviaron no cambian."
          confirmLabel="Borrar"
          onConfirm={() => catalog.remove(dialog.reply.id)}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </section>
  );
}
