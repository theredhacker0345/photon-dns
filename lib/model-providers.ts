import type { ModelProviderId } from "./host-contracts";

export type ModelCatalogEntry = {
  id: string;
  displayName: string;
  provider: ModelProviderId;
  ownedBy?: string;
  contextWindow?: number;
  capabilities?: string[];
  fetchedAt: string;
};

export type ProviderPreset = {
  id: ModelProviderId;
  label: string;
  description: string;
  defaultEndpoint: string;
  docsUrl: string;
  catalogProtocol: "openai-compatible";
};

export const MODEL_PROVIDER_PRESETS: readonly ProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    description: "OpenAI’s hosted model catalog",
    defaultEndpoint: "https://api.openai.com/v1",
    docsUrl: "https://platform.openai.com/docs/api-reference/models/list",
    catalogProtocol: "openai-compatible",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    description: "A unified catalog from many providers",
    defaultEndpoint: "https://openrouter.ai/api/v1",
    docsUrl: "https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties",
    catalogProtocol: "openai-compatible",
  },
  {
    id: "groq",
    label: "Groq",
    description: "GroqCloud hosted models",
    defaultEndpoint: "https://api.groq.com/openai/v1",
    docsUrl: "https://console.groq.com/docs/models",
    catalogProtocol: "openai-compatible",
  },
  {
    id: "mistral",
    label: "Mistral AI",
    description: "Mistral’s OpenAI-compatible API",
    defaultEndpoint: "https://api.mistral.ai/v1",
    docsUrl: "https://docs.mistral.ai/api/",
    catalogProtocol: "openai-compatible",
  },
  {
    id: "custom",
    label: "Custom compatible",
    description: "Any HTTPS OpenAI-compatible provider",
    defaultEndpoint: "",
    docsUrl: "https://github.com/openai/openai-openapi",
    catalogProtocol: "openai-compatible",
  },
];

export function getProviderPreset(provider: ModelProviderId) {
  return MODEL_PROVIDER_PRESETS.find((item) => item.id === provider) ?? MODEL_PROVIDER_PRESETS[0];
}

export function getModelListUrl(endpoint: string) {
  const clean = endpoint.trim().replace(/\/+$/, "");
  return clean.endsWith("/models") ? clean : `${clean}/models`;
}

export function buildProviderHeaders(apiKey: string) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asPositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

export function normalizeOpenAiCompatibleModels(payload: unknown, provider: ModelProviderId, fetchedAt: string): ModelCatalogEntry[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { data?: unknown }).data)) return [];
  return ((payload as { data: unknown[] }).data)
    .map<ModelCatalogEntry | null>((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const id = asNonEmptyString(record.id);
      if (!id) return null;
      const ownedBy = asNonEmptyString(record.owned_by) ?? asNonEmptyString(record.ownedBy) ?? undefined;
      const contextWindow = asPositiveInteger(record.context_length) ?? asPositiveInteger(record.contextWindow);
      const capabilities = Array.isArray(record.capabilities)
        ? record.capabilities.filter((value): value is string => typeof value === "string").slice(0, 12)
        : undefined;
      const entry: ModelCatalogEntry = { id, displayName: id, provider, fetchedAt };
      if (ownedBy) entry.ownedBy = ownedBy;
      if (contextWindow) entry.contextWindow = contextWindow;
      if (capabilities?.length) entry.capabilities = capabilities;
      return entry;
    })
    .filter((entry): entry is ModelCatalogEntry => entry !== null)
    .slice(0, 200);
}

export type ProviderAuthStatus = "authenticated" | "unauthorized" | "unavailable" | "not_configured" | "not_checked";

export type ProviderConnectionStatus = {
  authStatus: ProviderAuthStatus;
  latencyMs: number | null;
  checkedAt: string | null;
};

export type ModelDiscoveryResult = {
  ok: boolean;
  message: string;
  models: ModelCatalogEntry[];
  fetchedAt: string | null;
  connection: ProviderConnectionStatus;
};

export async function fetchProviderModels(input: {
  provider: ModelProviderId;
  endpoint: string;
  apiKey: string;
  signal?: AbortSignal;
}): Promise<ModelDiscoveryResult> {
  const fetchedAt = new Date().toISOString();
  const endpoint = input.endpoint.trim();
  if (!endpoint || !/^https:\/\//i.test(endpoint)) {
    return { ok: false, message: "Use an HTTPS provider endpoint before fetching models.", models: [], fetchedAt: null, connection: { authStatus: "not_configured", latencyMs: null, checkedAt: null } };
  }
  if (!input.apiKey.trim()) {
    return { ok: false, message: "Save a provider API token before fetching models.", models: [], fetchedAt: null, connection: { authStatus: "not_configured", latencyMs: null, checkedAt: null } };
  }
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const signal = controller.signal;
  const abortFromCaller = () => controller.abort();
  input.signal?.addEventListener("abort", abortFromCaller, { once: true });
  try {
    const response = await fetch(getModelListUrl(endpoint), {
      method: "GET",
      headers: buildProviderHeaders(input.apiKey.trim()),
      signal,
    });
    const payload: unknown = await response.json();
    const latencyMs = Math.max(0, Date.now() - startedAt);
    const checkedAt = new Date().toISOString();
    if (!response.ok) {
      const authStatus: ProviderAuthStatus = response.status === 401 || response.status === 403 ? "unauthorized" : "unavailable";
      return { ok: false, message: `Provider returned HTTP ${response.status}. Check the selected provider and token.`, models: [], fetchedAt: null, connection: { authStatus, latencyMs, checkedAt } };
    }
    const models = normalizeOpenAiCompatibleModels(payload, input.provider, fetchedAt);
    if (!models.length) {
      return { ok: false, message: "The provider responded, but no compatible models were found.", models: [], fetchedAt: null, connection: { authStatus: "authenticated", latencyMs, checkedAt } };
    }
    return { ok: true, message: `Found ${models.length} models from the provider.`, models, fetchedAt, connection: { authStatus: "authenticated", latencyMs, checkedAt } };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "The provider model request timed out after 15 seconds."
      : "Could not reach the provider model catalog. Check network access, endpoint, and token.";
    return { ok: false, message, models: [], fetchedAt: null, connection: { authStatus: "unavailable", latencyMs: Math.max(0, Date.now() - startedAt), checkedAt: new Date().toISOString() } };
  } finally {
    input.signal?.removeEventListener("abort", abortFromCaller);
    clearTimeout(timeout);
  }
}
