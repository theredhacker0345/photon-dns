import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import { canPreparePrivateHost, isValidTelegramChatId, normalizeHostName } from "@/lib/pocket-hermes-policy";
import { canStartWorker, defaultHostRuntimePolicy, defaultTelegramProxyConfiguration, getRuntimePolicyBlock, isAllowedModelEndpoint, isSafeRuntimePolicy, isSafeTelegramProxyConfiguration, requiresModelApiKey, type HostReadinessSnapshot, type HostRuntimePolicy, type ModelProviderId, type PublicTelegramProxyConfiguration, type TelegramProxyType } from "@/lib/host-contracts";
import { fetchProviderModels, getProviderPreset, resolveProviderEndpoint, type ModelCatalogEntry, type ModelDiscoveryResult, type ProviderConnectionStatus } from "@/lib/model-providers";
import { loadFavoriteModelIds, saveFavoriteModelIds } from "@/lib/model-favorites";
import { approveNativeCodeJob, clearNativeSupervisorConfiguration, enqueueNativeTask, listNativeTasks, preflightNativeModel, proposeNativeCodeJob, revokeNativeCodeJob, runNativeApprovedCodeJob, sendNativeTelegramTestMessage, startNativeSupervisor, stopNativeSupervisor, testNativeTelegramGateway, updateNativeMcpRuntimeConfig } from "@/lib/native-supervisor";
import { discoverRemoteMcpTools, type McpDiscoveryResult } from "@/lib/mcp-client";
import { MAX_REMOTE_MCP_SERVERS, normalizeRemoteMcpEndpoint, validateRemoteMcpDraft, type McpAuthMode, type McpToolApproval, type McpToolManifestItem, type RemoteMcpServer } from "@/lib/mcp-contracts";
import { importSkillFromGitHub } from "@/lib/github-skill-import";
import { buildSkillDraftPrompt, parseAiSkillDraftResponse } from "@/lib/skill-ai-draft";
import { getFirstPartySkill } from "@/lib/first-party-skills";
import { MAX_INSTALLED_SKILLS, MAX_SKILL_DRAFTS, type InstalledSkill, type SkillDraft, type SkillProvenance, isSafeSkillIdentifier, normalizeSkillManifest, parseSkillInput, validateJsonAgainstSchema, validateSkillPackage } from "@/lib/skill-contracts";
import { discardStagedSkillPackage, exportInstalledSkillPackage, installStagedSkillPackage, installVerifiedSkillPackage, readInstalledSkillPackage, readStagedSkillPackage, removeInstalledSkillPackage, stageSkillPackage } from "@/lib/skill-storage";

export type HostPhase = "unconfigured" | "ready" | "running" | "bridge_required" | "stopped";
export type HostEvent = { id: string; title: string; detail: string; severity: "info" | "success" | "warning"; createdAt: string };
export type Automation = { id: string; title: string; expression: string; delivery: string; enabled: boolean; createdAt: string };
export type AgentDraft = { id: string; body: string; createdAt: string };
export type SavedProviderConnection = { id: string; label: string; provider: ModelProviderId; endpoint: string; hasApiKey: boolean; createdAt: string };
export type AiSkillDraftRequest = { id: string; taskId: string; request: string; createdAt: string; status: "queued" | "review_ready" | "failed"; detail: string | null };
export const MAX_SAVED_PROVIDER_CONNECTIONS = 8;

type PublicHostConfig = {
  hostName: string;
  allowedChatId: string;
  modelProvider: ModelProviderId;
  modelEndpoint: string;
  modelName: string;
  hasTelegramToken: boolean;
  hasModelApiKey: boolean;
  telegramProxy: PublicTelegramProxyConfiguration;
  policy: HostRuntimePolicy;
};
type PersistedState = { config: PublicHostConfig; phase: HostPhase; events: HostEvent[]; automations: Automation[]; drafts: AgentDraft[]; modelCatalog: ModelCatalogEntry[]; modelCatalogFetchedAt: string | null; providerConnection: ProviderConnectionStatus; favoriteModelIds: string[]; mcpServers: RemoteMcpServer[]; mcpTools: McpToolManifestItem[]; mcpApprovals: McpToolApproval[]; providerConnections: SavedProviderConnection[]; activeProviderConnectionId: string | null; skillDrafts: SkillDraft[]; installedSkills: InstalledSkill[]; aiSkillDraftRequests: AiSkillDraftRequest[] };
type SaveConfigurationInput = {
  hostName: string;
  allowedChatId: string;
  modelProvider: ModelProviderId;
  modelEndpoint: string;
  modelName?: string;
  telegramToken: string;
  modelApiKey?: string;
  providerConnectionId?: string | null;
  createProviderConnection?: boolean;
  telegramProxy?: Pick<PublicTelegramProxyConfiguration, "type" | "host" | "port">;
  telegramProxyCredential?: string;
  clearTelegramProxyCredential?: boolean;
  policy?: HostRuntimePolicy;
};
export type GatewayTestInput = {
  telegramToken?: string;
  telegramProxy?: Pick<PublicTelegramProxyConfiguration, "type" | "host" | "port">;
  telegramProxyCredential?: string;
};
export type GatewayTestResult = { ok: boolean; message: string; botName?: string; latencyMs?: number | null };
type TestMessageResult = { ok: boolean; message: string; messageId?: number; deliveredAt?: string };
type ModelTestResult = { ok: boolean; message: string };
type SaveMcpServerInput = { id?: string; name: string; endpoint: string; authMode: McpAuthMode; credential?: string; enabled?: boolean };
type PocketHermesContextValue = PersistedState & {
  hydrated: boolean;
  saveConfiguration: (input: SaveConfigurationInput) => Promise<{ ok: boolean; message: string; connectionId?: string }>;
  selectProviderConnection: (connectionId: string) => Promise<void>;
  removeProviderConnection: (connectionId: string) => Promise<void>;
  testGateway: (input?: GatewayTestInput) => Promise<GatewayTestResult>;
  sendTestMessage: () => Promise<TestMessageResult>;
  testModel: () => Promise<ModelTestResult>;
  discoverModels: (input: { provider: ModelProviderId; endpoint: string; apiKey?: string }) => Promise<ModelDiscoveryResult>;
  testProviderConnection: (input: { provider: ModelProviderId; endpoint: string; apiKey?: string }) => Promise<ModelDiscoveryResult>;
  saveMcpServer: (input: SaveMcpServerInput) => Promise<McpDiscoveryResult>;
  removeMcpServer: (serverId: string) => Promise<void>;
  setMcpServerEnabled: (serverId: string, enabled: boolean) => void;
  approveMcpTool: (serverId: string, toolName: string) => void;
  revokeMcpToolApproval: (serverId: string, toolName: string) => void;
  importSkill: (githubUrl: string) => Promise<{ ok: boolean; message: string; draftId?: string }>;
  installFirstPartySkill: (catalogId: string) => Promise<{ ok: boolean; message: string; skillId?: string }>;
  requestAiSkillDraft: (request: string) => Promise<{ ok: boolean; message: string }>;
  refreshAiSkillDraftRequests: () => Promise<void>;
  getSkillDraftSource: (draftId: string) => Promise<string | null>;
  installSkillDraft: (draftId: string) => Promise<{ ok: boolean; message: string; skillId?: string }>;
  discardSkillDraft: (draftId: string) => Promise<void>;
  setSkillEnabled: (skillId: string, enabled: boolean) => Promise<void>;
  runSkill: (skillId: string, inputJson: string) => Promise<{ ok: boolean; message: string; output?: string }>;
  shareSkill: (skillId: string) => Promise<{ ok: boolean; message: string }>;
  removeSkill: (skillId: string) => Promise<void>;
  toggleFavoriteModel: (modelId: string) => void;
  isFavoriteModel: (modelId: string) => boolean;
  prepareRuntime: (readiness?: HostReadinessSnapshot) => Promise<void>;
  stopHost: () => Promise<void>;
  addAutomation: (input: Pick<Automation, "title" | "expression" | "delivery">) => void;
  setAutomationEnabled: (id: string, enabled: boolean) => void;
  addDraft: (body: string) => void;
  clearActivity: () => void;
  clearSensitiveConfiguration: () => Promise<void>;
};

const STORAGE_KEY = "pocket-hermes.control-plane.v1";
const TELEGRAM_TOKEN_KEY = "pocket-hermes.telegram-token";
const TELEGRAM_PROXY_CREDENTIAL_KEY = "pocket-hermes.telegram-proxy-credential";
const MODEL_API_KEY = "pocket-hermes.model-api-key";
const PROVIDER_CREDENTIAL_PREFIX = "pocket-hermes.provider-credential.";
const MCP_CREDENTIAL_PREFIX = "pocket-hermes.mcp-credential.";
const modelProviderIds = new Set<ModelProviderId>(["openai", "openrouter", "groq", "mistral", "kilo", "ollama", "lmstudio", "custom"]);
const emptyConfig: PublicHostConfig = {
  hostName: "Pocket Relay",
  allowedChatId: "",
  modelProvider: "openai",
  modelEndpoint: "https://api.openai.com/v1",
  modelName: "",
  hasTelegramToken: false,
  hasModelApiKey: false,
  telegramProxy: defaultTelegramProxyConfiguration,
  policy: defaultHostRuntimePolicy,
};
const initialState: PersistedState = { config: emptyConfig, phase: "unconfigured", events: [], automations: [], drafts: [], modelCatalog: [], modelCatalogFetchedAt: null, providerConnection: { authStatus: "not_checked", latencyMs: null, checkedAt: null }, favoriteModelIds: [], mcpServers: [], mcpTools: [], mcpApprovals: [], providerConnections: [], activeProviderConnectionId: null, skillDrafts: [], installedSkills: [], aiSkillDraftRequests: [] };
const PocketHermesContext = createContext<PocketHermesContextValue | null>(null);

function createId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function providerCredentialKey(connectionId: string) { return `${PROVIDER_CREDENTIAL_PREFIX}${connectionId}`; }

function normalizeSavedProviderConnections(value: unknown): SavedProviderConnection[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((candidate): SavedProviderConnection[] => {
      if (!candidate || typeof candidate !== "object") return [];
      const item = candidate as Record<string, unknown>;
      const id = typeof item.id === "string" ? item.id.trim() : "";
      const provider = typeof item.provider === "string" && modelProviderIds.has(item.provider as ModelProviderId) ? item.provider as ModelProviderId : null;
      const endpoint = typeof item.endpoint === "string" ? item.endpoint.trim() : "";
      if (!id || !provider) return [];
      return [{
        id,
        label: typeof item.label === "string" ? item.label.trim() : getProviderPreset(provider).label,
        provider,
        endpoint,
        hasApiKey: item.hasApiKey === true,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date(0).toISOString(),
      }];
    })
    .slice(0, MAX_SAVED_PROVIDER_CONNECTIONS);
}

function normalizeSkillProvenance(value: unknown): SkillProvenance | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (item.kind !== "github" && item.kind !== "ai" && item.kind !== "first_party") return null;
  const text = (key: string, maximum: number) => typeof item[key] === "string" ? item[key].trim().slice(0, maximum) : undefined;
  return {
    kind: item.kind,
    originalUrl: text("originalUrl", 600),
    repository: text("repository", 300),
    commitSha: text("commitSha", 64),
    manifestUrl: text("manifestUrl", 600),
    sourceUrl: text("sourceUrl", 600),
    request: text("request", 600),
    catalogId: text("catalogId", 80),
  };
}

function normalizeSkillDrafts(value: unknown): SkillDraft[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate): SkillDraft[] => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    const manifest = normalizeSkillManifest(item.manifest);
    const provenance = normalizeSkillProvenance(item.provenance);
    if (!isSafeSkillIdentifier(id) || !manifest.ok || !provenance) return [];
    return [{ id, manifest: manifest.value, provenance, createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date(0).toISOString() }];
  }).slice(0, MAX_SKILL_DRAFTS);
}

function normalizeInstalledSkills(value: unknown): InstalledSkill[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate): InstalledSkill[] => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    const manifest = normalizeSkillManifest(item.manifest);
    const provenance = normalizeSkillProvenance(item.provenance);
    const lastRunStatus = item.lastRunStatus === "ok" || item.lastRunStatus === "error" || item.lastRunStatus === "timeout" || item.lastRunStatus === "rejected" ? item.lastRunStatus : null;
    if (!isSafeSkillIdentifier(id) || !manifest.ok || !provenance) return [];
    return [{ id, manifest: manifest.value, provenance, installedAt: typeof item.installedAt === "string" ? item.installedAt : new Date(0).toISOString(), enabled: item.enabled === true, lastRunAt: typeof item.lastRunAt === "string" ? item.lastRunAt : null, lastRunStatus }];
  }).slice(0, MAX_INSTALLED_SKILLS);
}

function normalizeAiSkillDraftRequests(value: unknown): AiSkillDraftRequest[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate): AiSkillDraftRequest[] => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    const taskId = typeof item.taskId === "string" ? item.taskId : "";
    const request = typeof item.request === "string" ? item.request.trim().slice(0, 600) : "";
    const status = item.status === "queued" || item.status === "review_ready" || item.status === "failed" ? item.status : null;
    if (!isSafeSkillIdentifier(id) || !taskId || !request || !status) return [];
    return [{ id, taskId, request, status, createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date(0).toISOString(), detail: typeof item.detail === "string" ? item.detail.slice(0, 240) : null }];
  }).slice(0, MAX_SKILL_DRAFTS);
}

async function createMcpRuntimeConfig(
  servers: RemoteMcpServer[],
  tools: McpToolManifestItem[],
  approvals: McpToolApproval[],
) {
  const now = Date.now();
  const enabled = servers.filter((server) => server.enabled && server.connectionState === "verified");
  const runtimeServers = await Promise.all(enabled.map(async (server) => {
    const credential = server.authMode === "bearer" ? await readSecret(`${MCP_CREDENTIAL_PREFIX}${server.id}`) : null;
    if (server.authMode === "bearer" && !credential) return null;
    const serverTools = tools
      .filter((tool) => tool.serverId === server.id)
      .slice(0, 80)
      .map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema }));
    const approvedTools = approvals
      .filter((approval) => approval.serverId === server.id && new Date(approval.expiresAt).getTime() > now && serverTools.some((tool) => tool.name === approval.toolName))
      .map((approval) => ({ toolName: approval.toolName, expiresAt: approval.expiresAt }));
    return {
      id: server.id,
      endpoint: server.endpoint,
      authMode: server.authMode,
      credential: credential ?? undefined,
      tools: serverTools,
      approvedTools,
    };
  }));
  return JSON.stringify({ version: 1, servers: runtimeServers.filter(Boolean) });
}

async function saveSecret(key: string, value: string) {
  if (Platform.OS === "web") {
    globalThis.sessionStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function hasSecret(key: string) {
  if (Platform.OS === "web") return Boolean(globalThis.sessionStorage?.getItem(key));
  return Boolean(await SecureStore.getItemAsync(key));
}

async function readSecret(key: string) {
  if (Platform.OS === "web") return globalThis.sessionStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function deleteSecret(key: string) {
  if (Platform.OS === "web") {
    globalThis.sessionStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export function PocketHermesProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<PersistedState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [saved, favoriteIds] = await Promise.all([AsyncStorage.getItem(STORAGE_KEY), loadFavoriteModelIds()]);
        const parsed = saved ? (JSON.parse(saved) as PersistedState) : initialState;
        const [tokenAvailable, modelKeyAvailable, proxyCredentialAvailable] = await Promise.all([hasSecret(TELEGRAM_TOKEN_KEY), hasSecret(MODEL_API_KEY), hasSecret(TELEGRAM_PROXY_CREDENTIAL_KEY)]);
        if (active) {
          const providerConnections = normalizeSavedProviderConnections(parsed.providerConnections);
          const activeProviderConnectionId = providerConnections.some((connection) => connection.id === parsed.activeProviderConnectionId) ? parsed.activeProviderConnectionId : null;
          setState({
            ...parsed,
            config: {
              ...emptyConfig,
              ...parsed.config,
              policy: { ...defaultHostRuntimePolicy, ...parsed.config?.policy },
              hasTelegramToken: tokenAvailable,
              hasModelApiKey: modelKeyAvailable,
              telegramProxy: (() => {
                const candidate = parsed.config?.telegramProxy;
                if (!candidate || !isSafeTelegramProxyConfiguration(candidate)) return defaultTelegramProxyConfiguration;
                return { ...candidate, hasCredentials: candidate.type === "none" ? false : proxyCredentialAvailable };
              })(),
            },
            modelCatalog: Array.isArray(parsed.modelCatalog) ? parsed.modelCatalog.slice(0, 200) : [],
            modelCatalogFetchedAt: typeof parsed.modelCatalogFetchedAt === "string" ? parsed.modelCatalogFetchedAt : null,
            providerConnection: parsed.providerConnection ?? initialState.providerConnection,
            favoriteModelIds: favoriteIds,
            mcpServers: Array.isArray(parsed.mcpServers) ? parsed.mcpServers.slice(0, MAX_REMOTE_MCP_SERVERS) : [],
            mcpTools: Array.isArray(parsed.mcpTools) ? parsed.mcpTools.slice(0, MAX_REMOTE_MCP_SERVERS * 80) : [],
            mcpApprovals: Array.isArray(parsed.mcpApprovals) ? parsed.mcpApprovals.filter((approval) => approval && typeof approval.expiresAt === "string" && Date.parse(approval.expiresAt) > Date.now()).slice(0, 240) : [],
            providerConnections,
            activeProviderConnectionId,
            skillDrafts: normalizeSkillDrafts(parsed.skillDrafts),
            installedSkills: normalizeInstalledSkills(parsed.installedSkills),
            aiSkillDraftRequests: normalizeAiSkillDraftRequests(parsed.aiSkillDraftRequests),
          });
        }
      } catch {
        if (active) setState(initialState);
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const safeState: PersistedState = { ...state, config: { ...state.config, hasTelegramToken: false, hasModelApiKey: false } };
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(safeState));
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated || state.phase !== "running") return;
    let cancelled = false;
    void createMcpRuntimeConfig(state.mcpServers, state.mcpTools, state.mcpApprovals)
      .then((mcpConfigJson) => {
        if (!cancelled) return updateNativeMcpRuntimeConfig(mcpConfigJson);
        return false;
      })
      .catch(() => false);
    return () => { cancelled = true; };
  }, [hydrated, state.mcpApprovals, state.mcpServers, state.mcpTools, state.phase]);

  const appendEvent = useCallback((next: Omit<HostEvent, "id" | "createdAt">) => {
    setState((current) => ({ ...current, events: [{ ...next, id: createId("event"), createdAt: new Date().toISOString() }, ...current.events].slice(0, 60) }));
  }, []);

  const saveConfiguration = useCallback(async (input: SaveConfigurationInput) => {
    const allowedChatId = input.allowedChatId.trim();
    const suppliedToken = input.telegramToken.trim();
    const endpoint = resolveProviderEndpoint(input.modelProvider, input.modelEndpoint);
    const modelName = input.modelName?.trim() ?? state.config.modelName;
    const suppliedModelApiKey = input.modelApiKey?.trim() ?? "";
    const policy = input.policy ?? state.config.policy;
    const requestedProxy = input.telegramProxy ?? state.config.telegramProxy;
    const telegramProxy: PublicTelegramProxyConfiguration = {
      type: requestedProxy.type as TelegramProxyType,
      host: requestedProxy.type === "none" ? "" : requestedProxy.host.trim(),
      port: requestedProxy.type === "none" ? null : requestedProxy.port,
      hasCredentials: requestedProxy.type !== "none" && !input.clearTelegramProxyCredential
        && (Boolean(input.telegramProxyCredential?.trim()) || state.config.telegramProxy.hasCredentials),
    };
    const existingConnectionId = input.providerConnectionId ?? state.activeProviderConnectionId;
    const connectionId = input.createProviderConnection || !existingConnectionId ? createId("provider") : existingConnectionId;
    if (!isValidTelegramChatId(allowedChatId)) return { ok: false, message: "Use the positive numeric Telegram user ID for your private owner chat. Groups are not supported by the owner lock." };
    if (endpoint && !isAllowedModelEndpoint(endpoint, input.modelProvider)) {
      const message = requiresModelApiKey(input.modelProvider)
        ? "Use an HTTPS model endpoint without embedded user credentials."
        : "Use an HTTPS endpoint or a numeric private-LAN HTTP address without embedded user credentials.";
      return { ok: false, message };
    }
    if (!isSafeRuntimePolicy(policy)) return { ok: false, message: "The selected host power and storage policy is outside the supported safe range." };
    if (!isSafeTelegramProxyConfiguration(telegramProxy)) return { ok: false, message: "Use no proxy, or enter a valid HTTP/SOCKS5 proxy hostname and port." };
    if (suppliedToken) await saveSecret(TELEGRAM_TOKEN_KEY, suppliedToken);
    if (suppliedModelApiKey) await saveSecret(providerCredentialKey(connectionId), suppliedModelApiKey);
    if (telegramProxy.type === "none" || input.clearTelegramProxyCredential) await deleteSecret(TELEGRAM_PROXY_CREDENTIAL_KEY);
    else if (input.telegramProxyCredential?.trim()) await saveSecret(TELEGRAM_PROXY_CREDENTIAL_KEY, input.telegramProxyCredential.trim());
    const [tokenAvailable, modelKeyAvailable] = await Promise.all([
      suppliedToken ? Promise.resolve(true) : hasSecret(TELEGRAM_TOKEN_KEY),
      suppliedModelApiKey ? Promise.resolve(true) : hasSecret(providerCredentialKey(connectionId)),
    ]);
    if (!tokenAvailable) return { ok: false, message: "Add a Telegram bot token before preparing the private gateway." };

    setState((current) => ({
      ...current,
      providerConnections: (() => {
        const next: SavedProviderConnection = { id: connectionId, label: getProviderPreset(input.modelProvider).label, provider: input.modelProvider, endpoint, hasApiKey: modelKeyAvailable, createdAt: current.providerConnections.find((connection) => connection.id === connectionId)?.createdAt ?? new Date().toISOString() };
        return [next, ...current.providerConnections.filter((connection) => connection.id !== connectionId)].slice(0, MAX_SAVED_PROVIDER_CONNECTIONS);
      })(),
      activeProviderConnectionId: connectionId,
      config: {
        hostName: normalizeHostName(input.hostName),
        allowedChatId,
        modelProvider: input.modelProvider,
        modelEndpoint: endpoint,
        modelName,
        hasTelegramToken: true,
        hasModelApiKey: modelKeyAvailable,
        telegramProxy,
        policy,
      },
      phase: "ready",
      events: [{ id: createId("event"), title: "Owner gateway configuration saved", detail: "Telegram credentials are protected on this device. The token is never shown in Pocket Relay.", severity: "success" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60),
    }));
    return { ok: true, message: "Secure configuration saved. Add model details before starting the embedded runtime.", connectionId };
  }, [state.activeProviderConnectionId, state.config.modelName, state.config.policy]);

  const selectProviderConnection = useCallback(async (connectionId: string) => {
    const connection = state.providerConnections.find((item) => item.id === connectionId);
    if (!connection) return;
    const hasApiKey = await hasSecret(providerCredentialKey(connectionId));
    setState((current) => ({
      ...current,
      activeProviderConnectionId: connectionId,
      config: { ...current.config, modelProvider: connection.provider, modelEndpoint: connection.endpoint, hasModelApiKey: hasApiKey },
      providerConnection: initialState.providerConnection,
      modelCatalog: [],
      modelCatalogFetchedAt: null,
    }));
  }, [state.providerConnections]);

  const removeProviderConnection = useCallback(async (connectionId: string) => {
    const remaining = state.providerConnections.filter((item) => item.id !== connectionId);
    await deleteSecret(providerCredentialKey(connectionId));
    const replacement = remaining[0] ?? null;
    const replacementHasKey = replacement ? await hasSecret(providerCredentialKey(replacement.id)) : false;
    setState((current) => ({
      ...current,
      providerConnections: current.providerConnections.filter((item) => item.id !== connectionId),
      activeProviderConnectionId: current.activeProviderConnectionId === connectionId ? replacement?.id ?? null : current.activeProviderConnectionId,
      config: current.activeProviderConnectionId === connectionId
        ? { ...current.config, modelProvider: replacement?.provider ?? "openai", modelEndpoint: replacement?.endpoint ?? "https://api.openai.com/v1", modelName: replacement ? current.config.modelName : "", hasModelApiKey: replacementHasKey }
        : current.config,
      modelCatalog: current.activeProviderConnectionId === connectionId ? [] : current.modelCatalog,
      modelCatalogFetchedAt: current.activeProviderConnectionId === connectionId ? null : current.modelCatalogFetchedAt,
    }));
  }, [state.providerConnections]);

  const discoverModels = useCallback(async (input: { provider: ModelProviderId; endpoint: string; apiKey?: string }) => {
    const apiKey = input.apiKey?.trim() || (state.activeProviderConnectionId ? await readSecret(providerCredentialKey(state.activeProviderConnectionId)) : null) || await readSecret(MODEL_API_KEY) || "";
    const result = await fetchProviderModels({ ...input, apiKey });
    if (result.ok) {
      setState((current) => ({ ...current, modelCatalog: result.models, modelCatalogFetchedAt: result.fetchedAt, providerConnection: result.connection }));
      appendEvent({ title: "Model catalog refreshed", detail: result.message, severity: "success" });
    } else {
      setState((current) => ({ ...current, providerConnection: result.connection }));
      appendEvent({ title: "Model catalog unavailable", detail: result.message, severity: "warning" });
    }
    return result;
  }, [appendEvent, state.activeProviderConnectionId]);

  const testProviderConnection = useCallback(async (input: { provider: ModelProviderId; endpoint: string; apiKey?: string }) => {
    const apiKey = input.apiKey?.trim() || (state.activeProviderConnectionId ? await readSecret(providerCredentialKey(state.activeProviderConnectionId)) : null) || await readSecret(MODEL_API_KEY) || "";
    const result = await fetchProviderModels({ ...input, apiKey });
    setState((current) => ({
      ...current,
      providerConnection: result.connection,
      ...(result.ok ? { modelCatalog: result.models, modelCatalogFetchedAt: result.fetchedAt } : {}),
    }));
    return result;
  }, []);

  const saveMcpServer = useCallback(async (input: SaveMcpServerInput): Promise<McpDiscoveryResult> => {
    const validation = validateRemoteMcpDraft(input);
    if (validation) return { ok: false, message: validation, tools: [], latencyMs: null, checkedAt: null };
    const serverId = input.id ?? createId("mcp");
    const existing = state.mcpServers.find((server) => server.id === serverId);
    if (!existing && state.mcpServers.length >= MAX_REMOTE_MCP_SERVERS) {
      return { ok: false, message: `Pocket Relay supports up to ${MAX_REMOTE_MCP_SERVERS} remote MCP servers. Remove one before adding another.`, tools: [], latencyMs: null, checkedAt: null };
    }
    const suppliedCredential = input.credential?.trim() ?? "";
    const credential = suppliedCredential || await readSecret(`${MCP_CREDENTIAL_PREFIX}${serverId}`) || "";
    const discovery = await discoverRemoteMcpTools({ endpoint: input.endpoint, authMode: input.authMode, credential });
    if (!discovery.ok) return discovery;
    if (input.authMode === "bearer" && !credential) {
      return { ok: false, message: "Add a bearer token before saving this connector.", tools: [], latencyMs: null, checkedAt: null };
    }
    if (suppliedCredential) await saveSecret(`${MCP_CREDENTIAL_PREFIX}${serverId}`, suppliedCredential);
    if (input.authMode === "none" && existing?.hasCredential) await deleteSecret(`${MCP_CREDENTIAL_PREFIX}${serverId}`);
    const nextServer: RemoteMcpServer = {
      id: serverId,
      name: input.name.trim(),
      endpoint: normalizeRemoteMcpEndpoint(input.endpoint),
      authMode: input.authMode,
      enabled: input.enabled ?? existing?.enabled ?? true,
      hasCredential: input.authMode === "bearer",
      connectionState: "verified",
      lastCheckedAt: discovery.checkedAt,
      latencyMs: discovery.latencyMs,
      toolCount: discovery.tools.length,
    };
    setState((current) => ({
      ...current,
      mcpServers: [nextServer, ...current.mcpServers.filter((server) => server.id !== serverId)].slice(0, MAX_REMOTE_MCP_SERVERS),
      mcpTools: [...discovery.tools.map((tool) => ({ ...tool, serverId })), ...current.mcpTools.filter((tool) => tool.serverId !== serverId)].slice(0, MAX_REMOTE_MCP_SERVERS * 80),
      mcpApprovals: current.mcpApprovals.filter((approval) => approval.serverId !== serverId),
      events: [{ id: createId("event"), title: "Remote MCP connector verified", detail: `${nextServer.name}: ${discovery.tools.length} tools discovered. Every tool call requires owner approval.`, severity: "success" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60),
    }));
    return discovery;
  }, [state.mcpServers]);

  const removeMcpServer = useCallback(async (serverId: string) => {
    await deleteSecret(`${MCP_CREDENTIAL_PREFIX}${serverId}`);
    setState((current) => ({
      ...current,
      mcpServers: current.mcpServers.filter((server) => server.id !== serverId),
      mcpTools: current.mcpTools.filter((tool) => tool.serverId !== serverId),
      mcpApprovals: current.mcpApprovals.filter((approval) => approval.serverId !== serverId),
      events: [{ id: createId("event"), title: "Remote MCP connector removed", detail: "The protected connector credential and all outstanding tool approvals were removed from this device.", severity: "warning" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60),
    }));
  }, []);

  const setMcpServerEnabled = useCallback((serverId: string, enabled: boolean) => {
    setState((current) => ({ ...current, mcpServers: current.mcpServers.map((server) => server.id === serverId ? { ...server, enabled } : server) }));
  }, []);

  const approveMcpTool = useCallback((serverId: string, toolName: string) => {
    if (!state.mcpTools.some((tool) => tool.serverId === serverId && tool.name === toolName)) return;
    const now = new Date();
    const approval: McpToolApproval = { id: createId("mcp-grant"), serverId, toolName, approvedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString() };
    setState((current) => ({ ...current, mcpApprovals: [approval, ...current.mcpApprovals.filter((item) => !(item.serverId === serverId && item.toolName === toolName))].slice(0, 240) }));
  }, [state.mcpTools]);

  const revokeMcpToolApproval = useCallback((serverId: string, toolName: string) => {
    setState((current) => ({ ...current, mcpApprovals: current.mcpApprovals.filter((approval) => !(approval.serverId === serverId && approval.toolName === toolName)) }));
  }, []);

  const importSkill = useCallback(async (githubUrl: string) => {
    if (Platform.OS !== "android") return { ok: false, message: "GitHub skill packages are reviewed and stored only by the installed Android app." };
    if (state.skillDrafts.length >= MAX_SKILL_DRAFTS) return { ok: false, message: `Keep up to ${MAX_SKILL_DRAFTS} staged skills. Discard one before importing another.` };
    const imported = await importSkillFromGitHub(githubUrl);
    if (!imported.ok) return imported;
    const draftId = createId("skill-draft");
    try {
      await stageSkillPackage(draftId, imported.value.skillPackage);
      const draft: SkillDraft = { id: draftId, manifest: imported.value.skillPackage.manifest, provenance: imported.value.provenance, createdAt: new Date().toISOString() };
      setState((current) => ({ ...current, skillDrafts: [draft, ...current.skillDrafts].slice(0, MAX_SKILL_DRAFTS), events: [{ id: createId("event"), title: "GitHub skill staged for review", detail: `${draft.manifest.name} was pinned to an immutable commit and is not installed or executable yet.`, severity: "info" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60) }));
      return { ok: true, message: "Skill fetched from one immutable GitHub commit. Review its manifest and source before installing.", draftId };
    } catch {
      return { ok: false, message: "The verified GitHub package could not be placed in Android-private staged storage." };
    }
  }, [state.skillDrafts.length]);

  const installFirstPartySkill = useCallback(async (catalogId: string) => {
    if (Platform.OS !== "android") return { ok: false, message: "Sample skills are installed only by the Android Pocket Relay host." };
    const sample = getFirstPartySkill(catalogId);
    if (!sample) return { ok: false, message: "This sample skill is no longer available." };
    if (state.installedSkills.length >= MAX_INSTALLED_SKILLS) return { ok: false, message: `Pocket Relay supports up to ${MAX_INSTALLED_SKILLS} installed skills. Remove one before installing another.` };
    if (state.installedSkills.some((item) => item.manifest.sourceSha256 === sample.skillPackage.manifest.sourceSha256)) return { ok: false, message: "This exact sample skill is already installed." };
    const verified = await validateSkillPackage(sample.skillPackage);
    if (!verified.ok) return { ok: false, message: "The bundled sample failed its source-hash verification and was blocked." };
    const skillId = createId("skill");
    try {
      await installVerifiedSkillPackage(skillId, verified.value);
      const installed: InstalledSkill = { id: skillId, manifest: verified.value.manifest, provenance: { kind: "first_party", catalogId: sample.id }, installedAt: new Date().toISOString(), enabled: false, lastRunAt: null, lastRunStatus: null };
      setState((current) => ({ ...current, installedSkills: [installed, ...current.installedSkills].slice(0, MAX_INSTALLED_SKILLS), events: [{ id: createId("event"), title: "Sample skill installed inactive", detail: `${installed.manifest.name} was source-hash verified and stored privately. Enable and approve it before execution.`, severity: "success" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60) }));
      return { ok: true, message: "Sample installed as inactive. It cannot run until you enable and approve it.", skillId };
    } catch {
      return { ok: false, message: "The verified sample could not be installed privately." };
    }
  }, [state.installedSkills]);

  const requestAiSkillDraft = useCallback(async (request: string) => {
    const cleanRequest = request.trim();
    if (Platform.OS !== "android") return { ok: false, message: "AI skill drafting is available only through the installed Android host." };
    if (cleanRequest.length < 8 || cleanRequest.length > 600) return { ok: false, message: "Describe the skill in 8–600 characters." };
    if (state.aiSkillDraftRequests.filter((item) => item.status === "queued").length >= 2) return { ok: false, message: "Wait for an existing AI skill draft request before queuing another." };
    const taskId = createId("ai-skill-task");
    const task = await enqueueNativeTask({ id: taskId, body: buildSkillDraftPrompt(cleanRequest) });
    if (!task) return { ok: false, message: "Start the private Hermes host before requesting an AI skill draft." };
    const draftRequest: AiSkillDraftRequest = { id: createId("ai-skill"), taskId, request: cleanRequest, createdAt: new Date().toISOString(), status: "queued", detail: null };
    setState((current) => ({ ...current, aiSkillDraftRequests: [draftRequest, ...current.aiSkillDraftRequests].slice(0, MAX_SKILL_DRAFTS), events: [{ id: createId("event"), title: "AI skill draft requested", detail: "Hermes may only return an untrusted draft. Pocket Relay will require owner review, installation, and a short-lived execution approval.", severity: "info" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60) }));
    return { ok: true, message: "Hermes is preparing an untrusted skill draft. Check its status here after the task finishes." };
  }, [state.aiSkillDraftRequests]);

  const refreshAiSkillDraftRequests = useCallback(async () => {
    if (Platform.OS !== "android" || !state.aiSkillDraftRequests.some((item) => item.status === "queued")) return;
    const tasks = await listNativeTasks();
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const resolvedDrafts: SkillDraft[] = [];
    const nextRequests: AiSkillDraftRequest[] = [];
    for (const request of state.aiSkillDraftRequests) {
      if (request.status !== "queued") { nextRequests.push(request); continue; }
      const task = taskById.get(request.taskId);
      if (!task || task.status === "queued" || task.status === "running") { nextRequests.push(request); continue; }
      if (task.status !== "succeeded" || !task.result) {
        nextRequests.push({ ...request, status: "failed", detail: task?.reason ?? "Hermes did not return a completed skill draft." });
        continue;
      }
      const parsed = await parseAiSkillDraftResponse(task.result, request.request);
      if (!parsed.ok) {
        nextRequests.push({ ...request, status: "failed", detail: parsed.message });
        continue;
      }
      try {
        await stageSkillPackage(request.id, parsed.value.skillPackage);
        resolvedDrafts.push({ id: request.id, manifest: parsed.value.skillPackage.manifest, provenance: parsed.value.provenance, createdAt: new Date().toISOString() });
        nextRequests.push({ ...request, status: "review_ready", detail: "A QuickJS skill draft is ready for owner review." });
      } catch {
        nextRequests.push({ ...request, status: "failed", detail: "The validated draft could not be placed in Android-private staged storage." });
      }
    }
    if (!resolvedDrafts.length && nextRequests.every((item, index) => item.status === state.aiSkillDraftRequests[index]?.status && item.detail === state.aiSkillDraftRequests[index]?.detail)) return;
    setState((current) => ({
      ...current,
      skillDrafts: [...resolvedDrafts, ...current.skillDrafts.filter((draft) => !resolvedDrafts.some((resolved) => resolved.id === draft.id))].slice(0, MAX_SKILL_DRAFTS),
      aiSkillDraftRequests: nextRequests.slice(0, MAX_SKILL_DRAFTS),
      events: resolvedDrafts.length ? [{ id: createId("event"), title: "AI skill draft ready for review", detail: "The draft remains staged and cannot run until you install, enable, and approve its exact source hash.", severity: "success" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60) : current.events,
    }));
  }, [state.aiSkillDraftRequests]);

  const installSkillDraft = useCallback(async (draftId: string) => {
    const draft = state.skillDrafts.find((item) => item.id === draftId);
    if (!draft) return { ok: false, message: "This staged skill is no longer available." };
    if (state.installedSkills.length >= MAX_INSTALLED_SKILLS) return { ok: false, message: `Pocket Relay supports up to ${MAX_INSTALLED_SKILLS} installed skills. Remove one before installing another.` };
    if (state.installedSkills.some((item) => item.manifest.sourceSha256 === draft.manifest.sourceSha256)) return { ok: false, message: "This exact skill source is already installed." };
    const skillId = createId("skill");
    try {
      await installStagedSkillPackage(draftId, skillId);
      const installed: InstalledSkill = { id: skillId, manifest: draft.manifest, provenance: draft.provenance, installedAt: new Date().toISOString(), enabled: false, lastRunAt: null, lastRunStatus: null };
      setState((current) => ({ ...current, skillDrafts: current.skillDrafts.filter((item) => item.id !== draftId), installedSkills: [installed, ...current.installedSkills].slice(0, MAX_INSTALLED_SKILLS), events: [{ id: createId("event"), title: "Skill installed inactive", detail: `${installed.manifest.name} is stored privately but remains disabled. Enable it and approve each exact execution source before it can run.`, severity: "success" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60) }));
      return { ok: true, message: "Skill installed as inactive. It cannot run until you enable and approve it.", skillId };
    } catch {
      return { ok: false, message: "The reviewed staged package could not be installed privately." };
    }
  }, [state.installedSkills, state.skillDrafts]);

  const getSkillDraftSource = useCallback(async (draftId: string) => {
    if (!state.skillDrafts.some((item) => item.id === draftId)) return null;
    try { return (await readStagedSkillPackage(draftId)).source; } catch { return null; }
  }, [state.skillDrafts]);

  const discardSkillDraft = useCallback(async (draftId: string) => {
    await discardStagedSkillPackage(draftId).catch(() => undefined);
    setState((current) => ({ ...current, skillDrafts: current.skillDrafts.filter((item) => item.id !== draftId), aiSkillDraftRequests: current.aiSkillDraftRequests.filter((item) => item.id !== draftId) }));
  }, []);

  const setSkillEnabled = useCallback(async (skillId: string, enabled: boolean) => {
    const skill = state.installedSkills.find((item) => item.id === skillId);
    if (!skill) return;
    if (!enabled) await revokeNativeCodeJob(skill.manifest.sourceSha256).catch(() => null);
    setState((current) => ({ ...current, installedSkills: current.installedSkills.map((item) => item.id === skillId ? { ...item, enabled } : item), events: [{ id: createId("event"), title: enabled ? "Skill enabled" : "Skill disabled", detail: enabled ? `${skill.manifest.name} is eligible for owner-initiated review and execution; its source is not yet approved.` : `${skill.manifest.name} was disabled and its active source approval was revoked.`, severity: "info" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60) }));
  }, [state.installedSkills]);

  const runSkill = useCallback(async (skillId: string, inputJson: string) => {
    const skill = state.installedSkills.find((item) => item.id === skillId);
    if (!skill) return { ok: false, message: "This installed skill is no longer available." };
    if (!skill.enabled) return { ok: false, message: "Enable this skill before reviewing and running it." };
    const input = parseSkillInput(inputJson, skill.manifest.inputSchema);
    if (!input.ok) return { ok: false, message: input.message };
    try {
      const storedPackage = await readInstalledSkillPackage(skillId);
      if (storedPackage.manifest.sourceSha256 !== skill.manifest.sourceSha256) return { ok: false, message: "The private skill package no longer matches its reviewed manifest and was blocked." };
      const proposal = await proposeNativeCodeJob(storedPackage.source);
      if (!proposal || proposal.hash !== skill.manifest.sourceSha256 || !proposal.approvalRequired) return { ok: false, message: "The isolated executor could not seal this exact installed source for owner approval." };
      const approval = await approveNativeCodeJob(storedPackage.source);
      if (!approval?.approved || approval.hash !== skill.manifest.sourceSha256) return { ok: false, message: "The owner approval for this exact source could not be recorded." };
      const result = await runNativeApprovedCodeJob({ source: storedPackage.source, inputJson });
      if (!result) return { ok: false, message: "The isolated executor did not return a result." };
      const occurredAt = new Date().toISOString();
      let message = result.output;
      let ok = result.status === "ok";
      if (ok) {
        try {
          const output = JSON.parse(result.output) as unknown;
          const outputIssue = validateJsonAgainstSchema(output, skill.manifest.outputSchema);
          if (outputIssue) { ok = false; message = `Skill output did not match its reviewed output schema: ${outputIssue}`; }
        } catch { ok = false; message = "The skill returned non-JSON output, which does not match its reviewed output schema."; }
      }
      const recordedStatus = ok ? "ok" : (result.status === "timeout" ? "timeout" : result.status === "rejected" ? "rejected" : "error");
      setState((current) => ({ ...current, installedSkills: current.installedSkills.map((item) => item.id === skillId ? { ...item, lastRunAt: occurredAt, lastRunStatus: recordedStatus } : item), events: [{ id: createId("event"), title: ok ? "Skill executed in isolation" : "Skill execution stopped", detail: ok ? `${skill.manifest.name} completed under the fixed 750 ms, 16 MiB, and 8 KiB sandbox envelope.` : `${skill.manifest.name}: ${message.slice(0, 180)}`, severity: ok ? "success" as const : "warning" as const, createdAt: occurredAt }, ...current.events].slice(0, 60) }));
      return ok ? { ok: true, message: "Skill completed in the isolated QuickJS process.", output: result.output } : { ok: false, message };
    } catch {
      return { ok: false, message: "The app-private skill package could not be verified for execution." };
    }
  }, [state.installedSkills]);

  const shareSkill = useCallback(async (skillId: string) => {
    const skill = state.installedSkills.find((item) => item.id === skillId);
    if (!skill) return { ok: false, message: "This installed skill is no longer available." };
    if (Platform.OS !== "android") return { ok: false, message: "Portable skill files can be shared only from the Android Pocket Relay host." };
    try {
      const Sharing = await import("expo-sharing");
      if (!(await Sharing.isAvailableAsync())) return { ok: false, message: "The Android system share sheet is not available on this device." };
      const exported = await exportInstalledSkillPackage(skillId);
      await Sharing.shareAsync(exported.uri, { dialogTitle: `Share ${skill.manifest.name}`, mimeType: "application/vnd.pocket-relay.skill+json" });
      setState((current) => ({ ...current, events: [{ id: createId("event"), title: "Skill export shared", detail: `${skill.manifest.name} was exported as a credential-free portable package. Recipients must still review and approve it.`, severity: "info" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60) }));
      return { ok: true, message: "Portable package opened in the Android share sheet. It contains only the manifest and QuickJS source, never tokens, approvals, logs, or host settings." };
    } catch {
      return { ok: false, message: "Pocket Relay could not create or share the portable skill package." };
    }
  }, [state.installedSkills]);

  const removeSkill = useCallback(async (skillId: string) => {
    const skill = state.installedSkills.find((item) => item.id === skillId);
    if (!skill) return;
    await Promise.all([revokeNativeCodeJob(skill.manifest.sourceSha256).catch(() => null), removeInstalledSkillPackage(skillId).catch(() => undefined)]);
    setState((current) => ({ ...current, installedSkills: current.installedSkills.filter((item) => item.id !== skillId), events: [{ id: createId("event"), title: "Skill deleted", detail: `${skill.manifest.name}, its private package files, and its active source approval were removed from this phone.`, severity: "warning" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60) }));
  }, [state.installedSkills]);

  const prepareRuntime = useCallback(async (readiness?: HostReadinessSnapshot) => {
    const [telegramToken, modelApiKey, mcpConfigJson, telegramProxyCredential] = await Promise.all([
      readSecret(TELEGRAM_TOKEN_KEY),
      state.activeProviderConnectionId ? readSecret(providerCredentialKey(state.activeProviderConnectionId)) : readSecret(MODEL_API_KEY),
      createMcpRuntimeConfig(state.mcpServers, state.mcpTools, state.mcpApprovals),
      readSecret(TELEGRAM_PROXY_CREDENTIAL_KEY),
    ]);
    const currentConfig = state.config;
    const startable = canStartWorker({
      hostName: currentConfig.hostName,
      ownerChatId: currentConfig.allowedChatId,
      telegramConfigured: currentConfig.hasTelegramToken,
      model: { provider: currentConfig.modelProvider, endpoint: currentConfig.modelEndpoint, model: currentConfig.modelName, hasApiKey: currentConfig.hasModelApiKey },
      policy: currentConfig.policy,
    });
    const policyBlock = readiness ? getRuntimePolicyBlock(currentConfig.policy, readiness) : null;
    const supervisorStarted = telegramToken && startable && !policyBlock
      ? await startNativeSupervisor({
          telegramToken,
          ownerChatId: currentConfig.allowedChatId,
          modelProvider: currentConfig.modelProvider,
          modelEndpoint: currentConfig.modelEndpoint || undefined,
          modelApiKey: modelApiKey || undefined,
          modelName: currentConfig.modelName || undefined,
          restartAfterBoot: currentConfig.policy.restartAfterBoot,
          chargingAware: currentConfig.policy.chargingAware,
          lowBatteryPercent: currentConfig.policy.lowBatteryPercent,
          minimumFreeStorageBytes: currentConfig.policy.minimumFreeStorageBytes,
          maximumCpuPercent: currentConfig.policy.maximumCpuPercent,
          maximumProcessRamBytes: currentConfig.policy.maximumProcessRamBytes,
          maximumWorkspaceBytes: currentConfig.policy.maximumWorkspaceBytes,
          mcpConfigJson,
          telegramProxyType: currentConfig.telegramProxy.type,
          telegramProxyHost: currentConfig.telegramProxy.host || undefined,
          telegramProxyPort: currentConfig.telegramProxy.port ?? undefined,
          telegramProxyCredential: telegramProxyCredential || undefined,
        })
      : false;
    setState((current) => {
      if (!startable) {
        return { ...current, events: [{ id: createId("event"), title: "Runtime preparation blocked", detail: "Save a Telegram owner lock, allowed model endpoint, model name, required provider credential, and a valid host policy first.", severity: "warning" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60) };
      }
      if (policyBlock) {
        return { ...current, events: [{ id: createId("event"), title: "Runtime preparation blocked by host policy", detail: policyBlock, severity: "warning" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60) };
      }
      if (supervisorStarted) {
        return { ...current, phase: "running", events: [{ id: createId("event"), title: "Android supervisor started", detail: "Pocket Relay is sampling this phone’s live process CPU and RAM through its foreground supervisor.", severity: "success" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60) };
      }
      return { ...current, phase: "bridge_required", events: [{ id: createId("event"), title: "Runtime preparation queued", detail: "The control plane is ready. Install a custom Android build to launch the native foreground supervisor and bundled Hermes runtime.", severity: "info" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60) };
    });
  }, [state.activeProviderConnectionId, state.config, state.mcpServers, state.mcpTools, state.mcpApprovals]);

  const testGateway = useCallback(async (input?: GatewayTestInput): Promise<GatewayTestResult> => {
    const draftProxy = input?.telegramProxy
      ? {
          type: input.telegramProxy.type,
          host: input.telegramProxy.type === "none" ? "" : input.telegramProxy.host.trim(),
          port: input.telegramProxy.type === "none" ? null : input.telegramProxy.port,
          hasCredentials: Boolean(input.telegramProxyCredential?.trim()),
        }
      : state.config.telegramProxy;
    if (!isSafeTelegramProxyConfiguration(draftProxy)) {
      return { ok: false, message: "Choose Direct or provide a valid HTTP or SOCKS5 proxy hostname and port before checking Telegram." };
    }
    const token = input?.telegramToken?.trim() || await readSecret(TELEGRAM_TOKEN_KEY);
    if (!token) return { ok: false, message: "Add a protected Telegram bot token before testing the gateway." };
    const savedRouteMatchesDraft = draftProxy.type === state.config.telegramProxy.type
      && draftProxy.host === state.config.telegramProxy.host
      && draftProxy.port === state.config.telegramProxy.port;
    const proxyCredential = input?.telegramProxyCredential?.trim()
      || (savedRouteMatchesDraft ? await readSecret(TELEGRAM_PROXY_CREDENTIAL_KEY) : "");
    const nativeResult = await testNativeTelegramGateway({
      telegramToken: token,
      telegramProxyType: draftProxy.type,
      telegramProxyHost: draftProxy.host || undefined,
      telegramProxyPort: draftProxy.port ?? undefined,
      telegramProxyCredential: proxyCredential || undefined,
    });
    if (nativeResult) {
      if (!nativeResult.ok) {
        appendEvent({ title: "Gateway check failed", detail: nativeResult.message, severity: "warning" });
        return { ok: false, message: nativeResult.message, latencyMs: nativeResult.latencyMs ?? null };
      }
      const botName = nativeResult.botName ? `@${nativeResult.botName}` : undefined;
      appendEvent({ title: "Gateway credential verified", detail: "Telegram accepted the protected bot credential through the configured device route.", severity: "success" });
      return { ok: true, message: "Telegram accepted the bot credential. No message was sent during this check.", botName, latencyMs: nativeResult.latencyMs ?? null };
    }
    if (draftProxy.type !== "none") {
      return { ok: false, message: "Telegram proxy checks require the installed Android build; web preview cannot route traffic through a device proxy." };
    }
    try {
      const checkStartedAt = Date.now();
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const latencyMs = Math.max(0, Date.now() - checkStartedAt);
      const payload = (await response.json()) as { ok?: boolean; result?: { username?: string; first_name?: string }; description?: string };
      if (!response.ok || !payload.ok) {
        appendEvent({ title: "Gateway check failed", detail: "Telegram did not accept the protected bot token. Recheck the token and network connection.", severity: "warning" });
        return { ok: false, message: payload.description ?? "Telegram did not accept this bot token.", latencyMs };
      }
      const botName = payload.result?.username ? `@${payload.result.username}` : payload.result?.first_name;
      appendEvent({ title: "Gateway credential verified", detail: "Telegram accepted the protected bot credential. The owner chat lock will be enforced when the embedded gateway starts.", severity: "success" });
      return { ok: true, message: "Telegram accepted the bot credential. No message was sent during this check.", botName, latencyMs };
    } catch {
      appendEvent({ title: "Gateway check unavailable", detail: "Pocket Relay could not reach Telegram. Check the phone’s network connection and try again.", severity: "warning" });
      return { ok: false, message: "Pocket Relay could not reach Telegram. Check the phone’s network and try again." };
    }
  }, [appendEvent, state.config.telegramProxy]);

  const sendTestMessage = useCallback(async (): Promise<TestMessageResult> => {
    const token = await readSecret(TELEGRAM_TOKEN_KEY);
    const allowedChatId = state.config.allowedChatId;
    if (!token || !isValidTelegramChatId(allowedChatId)) return { ok: false, message: "Save a protected bot token and a private owner Telegram user ID before sending a test message." };
    const proxyCredential = await readSecret(TELEGRAM_PROXY_CREDENTIAL_KEY);
    const nativeResult = await sendNativeTelegramTestMessage({
      telegramToken: token,
      ownerChatId: allowedChatId,
      telegramProxyType: state.config.telegramProxy.type,
      telegramProxyHost: state.config.telegramProxy.host || undefined,
      telegramProxyPort: state.config.telegramProxy.port ?? undefined,
      telegramProxyCredential: proxyCredential || undefined,
    });
    if (nativeResult) {
      if (!nativeResult.ok || typeof nativeResult.messageId !== "number") {
        appendEvent({ title: "Test message failed", detail: nativeResult.message, severity: "warning" });
        return { ok: false, message: nativeResult.message };
      }
      const deliveredAt = typeof nativeResult.deliveredAt === "number" ? new Date(nativeResult.deliveredAt * 1000).toISOString() : new Date().toISOString();
      appendEvent({ title: "Test message delivered", detail: `Telegram confirmed receipt as message #${nativeResult.messageId}.`, severity: "success" });
      return { ok: true, message: nativeResult.message, messageId: nativeResult.messageId, deliveredAt };
    }
    if (state.config.telegramProxy.type !== "none") {
      return { ok: false, message: "Telegram proxy delivery checks require the installed Android build; web preview cannot route traffic through a device proxy." };
    }
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: allowedChatId, text: "Pocket Relay connection check: this phone can deliver to your owner-only Telegram route." }),
      });
      const payload = (await response.json()) as { ok?: boolean; result?: { message_id?: number; date?: number }; description?: string };
      if (!response.ok || !payload.ok || typeof payload.result?.message_id !== "number") {
        appendEvent({ title: "Test message failed", detail: "Telegram did not confirm delivery to the private owner chat. Check the owner ID, start the bot, and try again.", severity: "warning" });
        return { ok: false, message: payload.description ?? "Telegram did not confirm delivery to the private owner chat." };
      }
      const deliveredAt = typeof payload.result.date === "number" ? new Date(payload.result.date * 1000).toISOString() : new Date().toISOString();
      appendEvent({ title: "Test message delivered", detail: `Telegram confirmed receipt as message #${payload.result.message_id}.`, severity: "success" });
      return { ok: true, message: "Telegram confirmed delivery to the allowed owner chat.", messageId: payload.result.message_id, deliveredAt };
    } catch {
      appendEvent({ title: "Test message unavailable", detail: "Pocket Relay could not reach Telegram. Check the phone’s network and try again.", severity: "warning" });
      return { ok: false, message: "Pocket Relay could not reach Telegram. Check the phone’s network and try again." };
    }
  }, [appendEvent, state.config.allowedChatId, state.config.telegramProxy]);

  const testModel = useCallback(async (): Promise<ModelTestResult> => {
    const modelApiKey = state.activeProviderConnectionId ? await readSecret(providerCredentialKey(state.activeProviderConnectionId)) : await readSecret(MODEL_API_KEY);
    const config = state.config;
    if (!config.modelEndpoint || !config.modelName || (requiresModelApiKey(config.modelProvider) && !modelApiKey)) {
      return { ok: false, message: "Save an allowed endpoint, model name, and any credential required by the selected provider before testing." };
    }
    const result = await preflightNativeModel({ modelProvider: config.modelProvider, modelEndpoint: config.modelEndpoint, modelApiKey: modelApiKey || undefined, modelName: config.modelName });
    if (!result) {
      return { ok: false, message: "Model preflight requires the installed Android APK. Web preview does not run the private Python runtime." };
    }
    appendEvent({ title: result.ok ? "Model endpoint verified" : "Model endpoint check failed", detail: result.reason, severity: result.ok ? "success" : "warning" });
    return { ok: result.ok, message: result.reason };
  }, [appendEvent, state.activeProviderConnectionId, state.config]);

  const stopHost = useCallback(async () => {
    const supervisorStopped = await stopNativeSupervisor();
    setState((current) => ({ ...current, phase: "stopped", events: [{ id: createId("event"), title: supervisorStopped ? "Android supervisor stopped" : "Host marked stopped", detail: supervisorStopped ? "The foreground supervisor was stopped and telemetry will no longer be sampled." : "The control plane will not request a new native runtime session until you prepare it again.", severity: "info" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60) }));
  }, []);

  const addAutomation = useCallback((input: Pick<Automation, "title" | "expression" | "delivery">) => {
    setState((current) => ({ ...current, automations: [{ ...input, id: createId("schedule"), enabled: true, createdAt: new Date().toISOString() }, ...current.automations] }));
    appendEvent({ title: "Automation saved", detail: `“${input.title}” will be delivered through ${input.delivery}.`, severity: "success" });
  }, [appendEvent]);

  const setAutomationEnabled = useCallback((id: string, enabled: boolean) => {
    setState((current) => ({ ...current, automations: current.automations.map((item) => (item.id === id ? { ...item, enabled } : item)) }));
  }, []);

  const addDraft = useCallback((body: string) => {
    const clean = body.trim();
    if (!clean) return;
    setState((current) => ({ ...current, drafts: [{ id: createId("draft"), body: clean, createdAt: new Date().toISOString() }, ...current.drafts].slice(0, 20) }));
    appendEvent({ title: "Instruction saved", detail: "The message is held locally until the native Hermes relay is connected.", severity: "info" });
  }, [appendEvent]);

  const clearActivity = useCallback(() => { setState((current) => ({ ...current, events: [], drafts: [] })); }, []);

  const toggleFavoriteModel = useCallback((modelId: string) => {
    setState((current) => {
      const exists = current.favoriteModelIds.includes(modelId);
      const nextFavorites = exists ? current.favoriteModelIds.filter((id) => id !== modelId) : [...current.favoriteModelIds, modelId];
      void saveFavoriteModelIds(nextFavorites);
      return { ...current, favoriteModelIds: nextFavorites };
    });
  }, []);

  const isFavoriteModel = useCallback((modelId: string) => {
    return state.favoriteModelIds.includes(modelId);
  }, [state.favoriteModelIds]);

  const clearSensitiveConfiguration = useCallback(async () => {
    await Promise.all([deleteSecret(TELEGRAM_TOKEN_KEY), deleteSecret(TELEGRAM_PROXY_CREDENTIAL_KEY), deleteSecret(MODEL_API_KEY), ...state.providerConnections.map((connection) => deleteSecret(providerCredentialKey(connection.id))), clearNativeSupervisorConfiguration()]);
    setState((current) => ({
      ...current,
      config: { ...current.config, hasTelegramToken: false, hasModelApiKey: false, telegramProxy: defaultTelegramProxyConfiguration },
      providerConnections: current.providerConnections.map((connection) => ({ ...connection, hasApiKey: false })),
      modelCatalog: [],
      modelCatalogFetchedAt: null,
      providerConnection: initialState.providerConnection,
      phase: "unconfigured",
      events: [{ id: createId("event"), title: "Sensitive configuration removed", detail: "Telegram and model credentials were removed from protected storage. The native host cannot restart until they are saved again.", severity: "warning" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60),
    }));
  }, [state.providerConnections]);

  const value = useMemo<PocketHermesContextValue>(() => ({ ...state, hydrated, saveConfiguration, selectProviderConnection, removeProviderConnection, testGateway, sendTestMessage, testModel, discoverModels, testProviderConnection, saveMcpServer, removeMcpServer, setMcpServerEnabled, approveMcpTool, revokeMcpToolApproval, importSkill, installFirstPartySkill, requestAiSkillDraft, refreshAiSkillDraftRequests, getSkillDraftSource, installSkillDraft, discardSkillDraft, setSkillEnabled, runSkill, shareSkill, removeSkill, toggleFavoriteModel, isFavoriteModel, prepareRuntime, stopHost, addAutomation, setAutomationEnabled, addDraft, clearActivity, clearSensitiveConfiguration }), [state, hydrated, saveConfiguration, selectProviderConnection, removeProviderConnection, testGateway, sendTestMessage, testModel, discoverModels, testProviderConnection, saveMcpServer, removeMcpServer, setMcpServerEnabled, approveMcpTool, revokeMcpToolApproval, importSkill, installFirstPartySkill, requestAiSkillDraft, refreshAiSkillDraftRequests, getSkillDraftSource, installSkillDraft, discardSkillDraft, setSkillEnabled, runSkill, shareSkill, removeSkill, toggleFavoriteModel, isFavoriteModel, prepareRuntime, stopHost, addAutomation, setAutomationEnabled, addDraft, clearActivity, clearSensitiveConfiguration]);
  return <PocketHermesContext.Provider value={value}>{children}</PocketHermesContext.Provider>;
}

export function usePocketHermes() {
  const context = useContext(PocketHermesContext);
  if (!context) throw new Error("usePocketHermes must be used inside PocketHermesProvider");
  return context;
}
