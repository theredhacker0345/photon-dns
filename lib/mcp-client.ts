import {
  classifyMcpToolRisk,
  isAllowedRemoteMcpEndpoint,
  isValidMcpToolName,
  type McpAuthMode,
  type McpToolManifestItem,
} from "./mcp-contracts";

type JsonRpcResponse = { id?: number; result?: unknown; error?: { code?: number; message?: string } };

export type McpDiscoveryResult = {
  ok: boolean;
  message: string;
  tools: Omit<McpToolManifestItem, "serverId">[];
  latencyMs: number | null;
  checkedAt: string | null;
};

function parseJsonRpcPayload(raw: string): JsonRpcResponse | null {
  const candidate = raw.trim();
  if (!candidate) return null;
  try {
    return JSON.parse(candidate) as JsonRpcResponse;
  } catch {
    const eventData = candidate
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    try {
      return eventData ? (JSON.parse(eventData) as JsonRpcResponse) : null;
    } catch {
      return null;
    }
  }
}

function safeErrorMessage(status: number, payload: JsonRpcResponse | null) {
  if (status === 401 || status === 403) return "The MCP server rejected this connector credential.";
  if (payload?.error?.message) return `The MCP server rejected discovery: ${payload.error.message.slice(0, 160)}.`;
  return `The MCP server returned HTTP ${status} during discovery.`;
}

async function rpcRequest(endpoint: string, body: Record<string, unknown>, headers: Record<string, string>) {
  const response = await fetch(endpoint, {
    method: "POST",
    redirect: "error",
    headers: { Accept: "application/json, text/event-stream", "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", ...body }),
  });
  const raw = await response.text();
  return { response, payload: parseJsonRpcPayload(raw) };
}

/**
 * Bounded remote discovery for Streamable HTTP MCP servers. It only calls
 * initialize and tools/list; no tool is executed while testing a connector.
 */
export async function discoverRemoteMcpTools(input: {
  endpoint: string;
  authMode: McpAuthMode;
  credential?: string;
}): Promise<McpDiscoveryResult> {
  const endpoint = input.endpoint.trim().replace(/\/+$/, "");
  if (!isAllowedRemoteMcpEndpoint(endpoint)) {
    return { ok: false, message: "Use a public HTTPS MCP endpoint before testing a connector.", tools: [], latencyMs: null, checkedAt: null };
  }
  const credential = input.credential?.trim() ?? "";
  if (input.authMode === "bearer" && !credential) {
    return { ok: false, message: "Add a bearer token before testing this connector.", tools: [], latencyMs: null, checkedAt: null };
  }

  const headers: Record<string, string> = input.authMode === "bearer" ? { Authorization: `Bearer ${credential}` } : {};
  const startedAt = Date.now();
  try {
    const initialized = await rpcRequest(endpoint, {
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "Pocket Agent Host", version: "1.0" },
      },
    }, headers);
    if (!initialized.response.ok || initialized.payload?.error) {
      return { ok: false, message: safeErrorMessage(initialized.response.status, initialized.payload), tools: [], latencyMs: Date.now() - startedAt, checkedAt: new Date().toISOString() };
    }
    const sessionId = initialized.response.headers.get("mcp-session-id");
    const toolHeaders = sessionId ? { ...headers, "mcp-session-id": sessionId } : headers;
    void rpcRequest(endpoint, { method: "notifications/initialized", params: {} }, toolHeaders).catch(() => undefined);
    const listed = await rpcRequest(endpoint, { id: 2, method: "tools/list", params: {} }, toolHeaders);
    if (!listed.response.ok || listed.payload?.error) {
      return { ok: false, message: safeErrorMessage(listed.response.status, listed.payload), tools: [], latencyMs: Date.now() - startedAt, checkedAt: new Date().toISOString() };
    }
    const result = listed.payload?.result as { tools?: unknown } | undefined;
    const tools = Array.isArray(result?.tools) ? result.tools.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const raw = item as { name?: unknown; description?: unknown; inputSchema?: unknown };
      const name = typeof raw.name === "string" ? raw.name.trim() : "";
      if (!isValidMcpToolName(name)) return [];
      const description = typeof raw.description === "string" ? raw.description.slice(0, 500) : "No description provided by server.";
      const inputSchema = raw.inputSchema && typeof raw.inputSchema === "object" && !Array.isArray(raw.inputSchema)
        ? raw.inputSchema as Record<string, unknown>
        : { type: "object" };
      if (JSON.stringify(inputSchema).length > 8_192) return [];
      return [{ name, description, inputSchema, risk: classifyMcpToolRisk(name, description) }];
    }).slice(0, 80) : [];
    return { ok: true, message: `${tools.length} tool${tools.length === 1 ? "" : "s"} discovered. Tools still require an owner approval for every call.`, tools, latencyMs: Date.now() - startedAt, checkedAt: new Date().toISOString() };
  } catch {
    return { ok: false, message: "The MCP server could not be reached securely. Check the endpoint and the phone’s network.", tools: [], latencyMs: Date.now() - startedAt, checkedAt: new Date().toISOString() };
  }
}
