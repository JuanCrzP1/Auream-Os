// ---------------------------------------------------------------------------
// Cómo conectar cada agente al servidor MCP de Auream (puro): el comando de
// Claude Code, la configuración JSON de Cursor y similares, y los datos para
// el nodo «MCP Client» de n8n. Con el token real (al crearlo) o un marcador.
// ---------------------------------------------------------------------------

export const TOKEN_PLACEHOLDER = "<tu-token>";

export interface McpSnippet {
  readonly id: "claude-code" | "json" | "n8n";
  readonly label: string;
  readonly hint: string;
  readonly code: string;
}

export function mcpSnippets(url: string, token: string = TOKEN_PLACEHOLDER): McpSnippet[] {
  return [
    {
      id: "claude-code",
      label: "Claude Code",
      hint: "Pégalo en tu terminal.",
      code: `claude mcp add --transport http auream ${url} --header "Authorization: Bearer ${token}"`
    },
    {
      id: "json",
      label: "Cursor y otros",
      hint: "En la configuración de servidores MCP del programa (mcp.json).",
      code: JSON.stringify({ mcpServers: { auream: { url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2)
    },
    {
      id: "n8n",
      label: "n8n",
      hint: "Nodo «MCP Client»: transporte HTTP Streamable y autenticación por encabezado.",
      code: `URL: ${url}\nEncabezado: Authorization\nValor: Bearer ${token}`
    }
  ];
}
