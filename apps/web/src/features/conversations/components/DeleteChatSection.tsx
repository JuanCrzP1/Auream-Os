import "./delete-chat.css";
import { useState } from "react";
import { ConfirmDialog } from "@shared/ui/dialog/ConfirmDialog";

/**
 * Al final de la info del contacto (zona de riesgo, como en Leona): eliminar
 * el chat con su historial. Solo lo ven dueños y administradores.
 */
export function DeleteChatSection({ name, onDelete }: { readonly name: string; readonly onDelete: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <section className="ios-group ios-group--danger" aria-label="Zona de riesgo">
      <button type="button" className="ios-group__danger" onClick={() => setConfirming(true)}>
        Eliminar chat
      </button>
      <p className="ios-group__hint">Borra los mensajes de este chat en Auream. El cliente sigue en Contactos, con sus etiquetas y ventas.</p>
      {confirming ? (
        <ConfirmDialog
          title={`¿Eliminar el chat con ${name}?`}
          message="Se borra todo su historial de mensajes en Auream y no se puede deshacer. En el WhatsApp del cliente no cambia nada; si vuelve a escribir, empieza un chat nuevo."
          confirmLabel="Eliminar chat"
          onConfirm={onDelete}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </section>
  );
}
