import type { ConversationLabel } from "@contracts/ConversationContracts";

// Etiquetas del cliente en la bandeja: un punto de su color y el nombre.

export function ChatLabel({ label }: { readonly label: Pick<ConversationLabel, "name" | "color"> }) {
  return (
    <span className="ios-label" style={{ ["--label-color" as string]: label.color }}>
      <span className="ios-label__dot" aria-hidden="true" />
      {label.name}
    </span>
  );
}

/** En cada fila de la lista: las primeras y «+N» con el resto. */
export function ChatLabels({ labels, max = 2 }: { readonly labels: ReadonlyArray<ConversationLabel>; readonly max?: number }) {
  if (labels.length === 0) return null;
  const hidden = labels.slice(max);
  return (
    <span className="ios-labels" aria-label={`Etiquetas: ${labels.map((label) => label.name).join(", ")}`}>
      {labels.slice(0, max).map((label) => (
        <ChatLabel key={label.id} label={label} />
      ))}
      {hidden.length ? <span className="ios-label ios-label--more" title={hidden.map((label) => label.name).join(", ")}>+{hidden.length}</span> : null}
    </span>
  );
}
