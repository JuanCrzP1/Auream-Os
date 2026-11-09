import { useState } from "react";
import { mcpSnippets } from "./connectionSnippets";
import { CopyButton } from "./CopyButton";

/** Cómo conectar cada agente: pestañas con el comando o la configuración lista para copiar. */
export function McpSnippets({ url, token }: { readonly url: string; readonly token?: string }) {
  const snippets = mcpSnippets(url, token);
  const [active, setActive] = useState(snippets[0]!.id);
  const snippet = snippets.find((item) => item.id === active)!;
  return (
    <div className="mcp-snippets">
      <div className="mcp-snippets__tabs" role="tablist" aria-label="Agente">
        {snippets.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={item.id === active} className="mcp-snippets__tab" onClick={() => setActive(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <p className="ui-muted">{snippet.hint}</p>
      <div className="mcp-snippets__code">
        <pre>{snippet.code}</pre>
        <CopyButton text={snippet.code} />
      </div>
    </div>
  );
}
