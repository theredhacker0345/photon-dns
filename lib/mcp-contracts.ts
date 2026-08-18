/**
 * Public, secret-free contracts for remote Model Context Protocol servers.
 *
 * Pocket Relay deliberately supports only remote HTTPS transports. Local
 * stdio servers are not appropriate for a mobile foreground host because they
 * require unmanaged child processes and broaden the device attack surface.
 */
export const MAX_REMOTE_MCP_SERVERS = 6;
export const MAX_MCP_TOOL_ARGUMENT_BYTES = 24 * 1024;

export type McpAuthMode = "none" | "bearer";
export type McpToolRisk = "read" | "side_effect" | "unknown";
export type McpConnectionState = "not_checked" | "verified" | "error";

export type RemoteMcpServer = {
  id: string;
  name: string;
  endpoint: string;
  authMode: McpAuthMode;
  enabled: boolean;
  hasCredential: boolean;
  connectionState: McpConnectionState;
  lastCheckedAt: string | null;
  latencyMs: number | null;
  toolCount: number;
};

export type McpToolManifestItem = {
  serverId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  risk: McpToolRisk;
};

export type McpToolApproval = {
  id: string;
  serverId: string;
  toolName: string;
  approvedAt: string;
  expiresAt: string;
};

export type McpServerDraft = Pick<RemoteMcpServer, "name" | "endpoint" | "authMode">;

const toolName = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;

function isNonPublicIpv4(hostname: string) {
  const octets = hostname.split(".");
  if (octets.length !== 4 || octets.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const [first, second, third] = octets.map(Number);
  if ([first, second, third].some((part) => part < 0 || part > 255)) return false;
  return first === 0
    || first === 10
    || (first === 100 && second >= 64 && second <= 127)
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && (second === 0 || second === 168))
    || (first === 198 && (second === 18 || second === 19 || (second === 51 && third === 100)))
    || (first === 203 && second === 0 && third === 113)
    || first >= 224;
}

export function isAllowedRemoteMcpEndpoint(endpoint: string) {
  const candidate = endpoint.trim();
  if (!candidate) return false;
  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase();
    return parsed.protocol === "https:"
      && !parsed.username
      && !parsed.password
      && (!parsed.port || parsed.port === "443")
      && Boolean(hostname)
      && hostname !== "localhost"
      && !hostname.endsWith(".localhost")
      && !hostname.includes(":")
      && !isNonPublicIpv4(hostname);
  } catch {
    return false;
  }
}

export function normalizeRemoteMcpEndpoint(endpoint: string) {
  const candidate = endpoint.trim().replace(/\/+$/, "");
  return isAllowedRemoteMcpEndpoint(candidate) ? candidate : "";
}

export function validateRemoteMcpDraft(draft: McpServerDraft): string | null {
  if (draft.name.trim().length < 2 || draft.name.trim().length > 48) {
    return "Give this connector a name between 2 and 48 characters.";
  }
  if (!isAllowedRemoteMcpEndpoint(draft.endpoint)) {
    return "Use a public HTTPS MCP endpoint without embedded credentials or a local/private address.";
  }
  if (draft.authMode !== "none" && draft.authMode !== "bearer") {
    return "Choose bearer token or no authentication.";
  }
  return null;
}

export function classifyMcpToolRisk(name: string, description: string): McpToolRisk {
  const haystack = `${name} ${description}`.toLowerCase();
  if (/\b(delete|remove|send|post|create|update|write|transfer|purchase|pay|deploy|run|execute)\b/.test(haystack)) {
    return "side_effect";
  }
  if (/\b(get|list|search|read|fetch|lookup|status|find)\b/.test(haystack)) return "read";
  return "unknown";
}

export function isValidMcpToolName(name: string) {
  return toolName.test(name);
}

/** Every remote tool invocation must receive a fresh, owner-visible approval. */
export function requiresOwnerApproval(_tool: Pick<McpToolManifestItem, "risk">) {
  return true;
}

export function isSafeMcpArgumentsJson(argumentsJson: string) {
  if (argumentsJson.length > MAX_MCP_TOOL_ARGUMENT_BYTES) return false;
  try {
    const parsed: unknown = JSON.parse(argumentsJson);
    return Boolean(parsed) && typeof parsed === "object" && !Array.isArray(parsed);
  } catch {
    return false;
  }
}
