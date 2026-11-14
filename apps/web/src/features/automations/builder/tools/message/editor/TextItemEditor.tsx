import type { MessageTextItem } from "../types";
import { useAutoHeight } from "../../_kit/useAutoHeight";
import { VariableHost, useVariableInsertion } from "../../_kit/variables/VariablePicker";

interface TextItemEditorProps {
  readonly item: MessageTextItem;
  readonly position: number;
  readonly onEdit: (change: { text: string }) => void;
}

/**
 * Cuerpo de un bloque de texto: arranca en tres renglones, crece hasta el tope
 * del CSS y desplaza por dentro (el nodo expandido tiene tamaño fijo).
 */
export function TextItemEditor({ item, position, onEdit }: TextItemEditorProps) {
  const fieldRef = useAutoHeight(item.text);
  const picker = useVariableInsertion(item.text, (text) => onEdit({ text }), fieldRef);

  return (
    <div className="message-item__body">
      <VariableHost picker={picker} multiline>
        <textarea
          ref={fieldRef}
          className="message-item__text nodrag nowheel"
          value={item.text}
          onChange={(event) => onEdit({ text: event.target.value })}
          placeholder="Escribe tu mensaje"
          aria-label={`Texto del bloque ${position}`}
          // Explícito: `wrap="off"` es lo único que haría que dejara de envolver.
          wrap="soft"
          spellCheck
        />
      </VariableHost>
    </div>
  );
}
