import { CopyButton } from "./CopyButton";
import { McpSnippets } from "./McpSnippets";

/** La dirección del servidor MCP y cómo conectar Claude (web, escritorio y Code), Cursor o n8n. */
export function McpServerCard({ url }: { readonly url: string }) {
  return (
    <section className="ui-panel mcp-server" aria-labelledby="mcp-server-title">
      <div className="webhook-card">
        <header>
          <h2 id="mcp-server-title">Servidor MCP</h2>
          <p className="ui-muted">Conecta un agente de IA a tu cuenta: lee y actúa por ti solo con los permisos de su credencial. Cada acción queda registrada.</p>
        </header>
        <div className="webhook-address">
          <input className="ui-input webhook-address__url" readOnly value={url} aria-label="Dirección del servidor MCP" onFocus={(event) => event.target.select()} />
          <CopyButton text={url} />
        </div>
        <McpSnippets url={url} />
        <p className="ui-muted mcp-server__note">Claude en la web y en el escritorio se conecta solo con la dirección: al conectarlo inicias sesión y eliges los permisos, y aparece aquí como una credencial más. Para los demás, crea una credencial con su token.</p>
      </div>
    </section>
  );
}
