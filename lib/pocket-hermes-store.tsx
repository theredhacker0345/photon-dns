import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import { canPreparePrivateHost, isValidTelegramChatId, normalizeHostName } from "@/lib/pocket-hermes-policy";
import { canStartWorker, defaultHostRuntimePolicy, getRuntimePolicyBlock, isAllowedModelEndpoint, isSafeRuntimePolicy, type HostReadinessSnapshot, type HostRuntimePolicy, type ModelProviderId } from "@/lib/host-contracts";
import { fetchProviderModels, resolveProviderEndpoint, type ModelCatalogEntry, type ModelDiscoveryResult, type ProviderConnectionStatus } from "@/lib/model-providers";
import { loadFavoriteModelIds, saveFavoriteModelIds } from "@/lib/model-favorites";
import { clearNativeSupervisorConfiguration, preflightNativeModel, startNativeSupervisor, stopNativeSupervisor, updateNativeMcpRuntimeConfig } from "@/lib/native-supervisor";
import { discoverRemoteMcpTools, type McpDiscoveryResult } from "@/lib/mcp-client";
import { MAX_REMOTE_MCP_SERVERS, normalizeRemoteMcpEndpoint, validateRemoteMcpDraft, type McpAuthMode, type McpToolApproval, type McpToolManifestItem, type RemoteMcpServer } from "@/lib/mcp-contracts";

export type HostPhase = "unconfigured" | "ready" | "running" | "bridge_required" | "stopped";
export type HostEvent = { id: string; title: string; detail: string; severity: "info" | "success" | "warning"; createdAt: string };
export type Automation = { id: string; title: string; expression: string; delivery: string; enabled: boolean; createdAt: string };
export type AgentDraft = { id: string; body: string; createdAt: string };

type PublicHostConfig = {
  hostName: string;
  allowedChatId: string;
  modelProvider: ModelProviderId;
  modelEndpoint: string;
  modelName: string;
  hasTelegramToken: boolean;
  hasModelApiKey: boolean;
  policy: HostRuntimePolicy;
};
type PersistedState = { config: PublicHostConfig; phase: HostPhase; events: HostEvent[]; automations: Automation[]; drafts: AgentDraft[]; modelCatalog: ModelCatalogEntry[]; modelCatalogFetchedAt: string | null; providerConnection: ProviderConnectionStatus; favoriteModelIds: string[]; mcpServers: RemoteMcpServer[]; mcpTools: McpToolManifestItem[]; mcpApprovals: McpToolApproval[] };
type SaveConfigurationInput = {
  hostName: string;
  allowedChatId: string;
  modelProvider: ModelProviderId;
  modelEndpoint: string;
  modelName?: string;
  telegramToken: string;
  modelApiKey?: string;
  policy?: HostRuntimePolicy;
};
type GatewayTestResult = { ok: boolean; message: string; botName?: string };
type TestMessageResult = { ok: boolean; message: string; messageId?: number; deliveredAt?: string };
type ModelTestResult = { ok: boolean; message: string };
type SaveMcpServerInput = { id?: string; name: string; endpoint: string; authMode: McpAuthMode; credential?: string; enabled?: boolean };
type PocketHermesContextValue = PersistedState & {
  hydrated: boolean;
  saveConfiguration: (input: SaveConfigurationInput) => Promise<{ ok: boolean; message: string }>;
  testGateway: () => Promise<GatewayTestResult>;
  sendTestMessage: () => Promise<TestMessageResult>;
  testModel: () => Promise<ModelTestResult>;
  discoverModels: (input: { provider: ModelProviderId; endpoint: string; apiKey?: string }) => Promise<ModelDiscoveryResult>;
  testProviderConnection: (input: { provider: ModelProviderId; endpoint: string; apiKey?: string }) => Promise<ModelDiscoveryResult>;
  saveMcpServer: (input: SaveMcpServerInput) => Promise<McpDiscoveryResult>;
  removeMcpServer: (serverId: string) => Promise<void>;
  setMcpServerEnabled: (serverId: string, enabled: boolean) => void;
  approveMcpTool: (serverId: string, toolName: string) => void;
  revokeMcpToolApproval: (serverId: string, toolName: string) => void;
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
const MODEL_API_KEY = "pocket-hermes.model-api-key";
const MCP_CREDENTIAL_PREFIX = "pocket-hermes.mcp-credential.";
const emptyConfig: PublicHostConfig = {
  hostName: "Pocket Agent Host",
  allowedChatId: "",
  modelProvider: "openai",
  modelEndpoint: "https://api.openai.com/v1",
  modelName: "",
  hasTelegramToken: false,
  hasModelApiKey: false,
  policy: defaultHostRuntimePolicy,
};
const initialState: PersistedState = { config: emptyConfig, phase: "unconfigured", events: [], automations: [], drafts: [], modelCatalog: [], modelCatalogFetchedAt: null, providerConnection: { authStatus: "not_checked", latencyMs: null, checkedAt: null }, favoriteModelIds: [], mcpServers: [], mcpTools: [], mcpApprovals: [] };
const PocketHermesContext = createContext<PocketHermesContextValue | null>(null);

function createId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

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
        const [tokenAvailable, modelKeyAvailable] = await Promise.all([hasSecret(TELEGRAM_TOKEN_KEY), hasSecret(MODEL_API_KEY)]);
        if (active) {
          setState({
            ...parsed,
            config: {
              ...emptyConfig,
              ...parsed.config,
              policy: { ...defaultHostRuntimePolicy, ...parsed.config?.policy },
              hasTelegramToken: tokenAvailable,
              hasModelApiKey: modelKeyAvailable,
            },
            modelCatalog: Array.isArray(parsed.modelCatalog) ? parsed.modelCatalog.slice(0, 200) : [],
            modelCatalogFetchedAt: typeof parsed.modelCatalogFetchedAt === "string" ? parsed.modelCatalogFetchedAt : null,
            providerConnection: parsed.providerConnection ?? initialState.providerConnection,
            favoriteModelIds: favoriteIds,
            mcpServers: Array.isArray(parsed.mcpServers) ? parsed.mcpServers.slice(0, MAX_REMOTE_MCP_SERVERS) : [],
            mcpTools: Array.isArray(parsed.mcpTools) ? parsed.mcpTools.slice(0, MAX_REMOTE_MCP_SERVERS * 80) : [],
            mcpApprovals: Array.isArray(parsed.mcpApprovals) ? parsed.mcpApprovals.filter((approval) => approval && typeof approval.expiresAt === "string" && Date.parse(approval.expiresAt) > Date.now()).slice(0, 240) : [],
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
    if (!isValidTelegramChatId(allowedChatId)) return { ok: false, message: "Use the positive numeric Telegram user ID for your private owner chat. Groups are not supported by the owner lock." };
    if (endpoint && !isAllowedModelEndpoint(endpoint)) return { ok: false, message: "Use an HTTPS model endpoint without embedded user credentials." };
    if (!isSafeRuntimePolicy(policy)) return { ok: false, message: "The selected host power and storage policy is outside the supported safe range." };
    if (suppliedToken) await saveSecret(TELEGRAM_TOKEN_KEY, suppliedToken);
    if (suppliedModelApiKey) await saveSecret(MODEL_API_KEY, suppliedModelApiKey);
    const [tokenAvailable, modelKeyAvailable] = await Promise.all([
      suppliedToken ? Promise.resolve(true) : hasSecret(TELEGRAM_TOKEN_KEY),
      suppliedModelApiKey ? Promise.resolve(true) : hasSecret(MODEL_API_KEY),
    ]);
    if (!tokenAvailable) return { ok: false, message: "Add a Telegram bot token before preparing the private gateway." };

    setState((current) => ({
      ...current,
        config: {
        hostName: normalizeHostName(input.hostName),
        allowedChatId,
        modelProvider: input.modelProvider,
        modelEndpoint: endpoint,
        modelName,
        hasTelegramToken: true,
        hasModelApiKey: modelKeyAvailable,
        policy,
      },
      phase: "ready",
      events: [{ id: createId("event"), title: "Owner gateway configuration saved", detail: "Telegram credentials are protected on this device. The token is never shown in Pocket Agent Host.", severity: "success" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60),
    }));
    return { ok: true, message: "Secure configuration saved. Add model details before starting the embedded runtime." };
  }, [state.config.modelName, state.config.policy]);

  const discoverModels = useCallback(async (input: { provider: ModelProviderId; endpoint: string; apiKey?: string }) => {
    const apiKey = input.apiKey?.trim() || await readSecret(MODEL_API_KEY) || "";
    const result = await fetchProviderModels({ ...input, apiKey });
    if (result.ok) {
      setState((current) => ({ ...current, modelCatalog: result.models, modelCatalogFetchedAt: result.fetchedAt, providerConnection: result.connection }));
      appendEvent({ title: "Model catalog refreshed", detail: result.message, severity: "success" });
    } else {
      setState((current) => ({ ...current, providerConnection: result.connection }));
      appendEvent({ title: "Model catalog unavailable", detail: result.message, severity: "warning" });
    }
    return result;
  }, [appendEvent]);

  const testProviderConnection = useCallback(async (input: { provider: ModelProviderId; endpoint: string; apiKey?: string }) => {
    const apiKey = input.apiKey?.trim() || await readSecret(MODEL_API_KEY) || "";
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
      return { ok: false, message: `Pocket Agent Host supports up to ${MAX_REMOTE_MCP_SERVERS} remote MCP servers. Remove one before adding another.`, tools: [], latencyMs: null, checkedAt: null };
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

  const prepareRuntime = useCallback(async (readiness?: HostReadinessSnapshot) => {
    const [telegramToken, modelApiKey, mcpConfigJson] = await Promise.all([
      readSecret(TELEGRAM_TOKEN_KEY),
      readSecret(MODEL_API_KEY),
      createMcpRuntimeConfig(state.mcpServers, state.mcpTools, state.mcpApprovals),
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
    const supervisorStarted = telegramToken && modelApiKey && startable && !policyBlock
      ? await startNativeSupervisor({
          telegramToken,
          ownerChatId: currentConfig.allowedChatId,
          modelEndpoint: currentConfig.modelEndpoint || undefined,
          modelApiKey,
          modelName: currentConfig.modelName || undefined,
          restartAfterBoot: currentConfig.policy.restartAfterBoot,
          chargingAware: currentConfig.policy.chargingAware,
          lowBatteryPercent: currentConfig.policy.lowBatteryPercent,
          minimumFreeStorageBytes: currentConfig.policy.minimumFreeStorageBytes,
          maximumCpuPercent: currentConfig.policy.maximumCpuPercent,
          maximumProcessRamBytes: currentConfig.policy.maximumProcessRamBytes,
          maximumWorkspaceBytes: currentConfig.policy.maximumWorkspaceBytes,
          mcpConfigJson,
        })
      : false;
    setState((current) => {
      if (!startable) {
        return { ...current, events: [{ id: createId("event"), title: "Runtime preparation blocked", detail: "Save a Telegram owner lock, HTTPS model endpoint, model name, model credential, and a valid host policy first.", severity: "warning" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60) };
      }
      if (policyBlock) {
        return { ...current, events: [{ id: createId("event"), title: "Runtime preparation blocked by host policy", detail: policyBlock, severity: "warning" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60) };
      }
      if (supervisorStarted) {
        return { ...current, phase: "running", events: [{ id: createId("event"), title: "Android supervisor started", detail: "Pocket Agent Host is sampling this phone’s live process CPU and RAM through its foreground supervisor.", severity: "success" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60) };
      }
      return { ...current, phase: "bridge_required", events: [{ id: createId("event"), title: "Runtime preparation queued", detail: "The control plane is ready. Install a custom Android build to launch the native foreground supervisor and bundled Hermes runtime.", severity: "info" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60) };
    });
  }, [state.config, state.mcpServers, state.mcpTools, state.mcpApprovals]);

  const testGateway = useCallback(async (): Promise<GatewayTestResult> => {
    const token = await readSecret(TELEGRAM_TOKEN_KEY);
    if (!token) return { ok: false, message: "Add a protected Telegram bot token before testing the gateway." };
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const payload = (await response.json()) as { ok?: boolean; result?: { username?: string; first_name?: string }; description?: string };
      if (!response.ok || !payload.ok) {
        appendEvent({ title: "Gateway check failed", detail: "Telegram did not accept the protected bot token. Recheck the token and network connection.", severity: "warning" });
        return { ok: false, message: payload.description ?? "Telegram did not accept this bot token." };
      }
      const botName = payload.result?.username ? `@${payload.result.username}` : payload.result?.first_name;
      appendEvent({ title: "Gateway credential verified", detail: "Telegram accepted the protected bot credential. The owner chat lock will be enforced when the embedded gateway starts.", severity: "success" });
      return { ok: true, message: "Telegram accepted the bot credential. No message was sent during this check.", botName };
    } catch {
      appendEvent({ title: "Gateway check unavailable", detail: "Pocket Agent Host could not reach Telegram. Check the phone’s network connection and try again.", severity: "warning" });
      return { ok: false, message: "Pocket Agent Host could not reach Telegram. Check the phone’s network and try again." };
    }
  }, [appendEvent]);

  const sendTestMessage = useCallback(async (): Promise<TestMessageResult> => {
    const token = await readSecret(TELEGRAM_TOKEN_KEY);
    const allowedChatId = state.config.allowedChatId;
    if (!token || !isValidTelegramChatId(allowedChatId)) return { ok: false, message: "Save a protected bot token and a private owner Telegram user ID before sending a test message." };
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: allowedChatId, text: "Pocket Agent Host connection check: this phone can deliver to your owner-only Telegram route." }),
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
      appendEvent({ title: "Test message unavailable", detail: "Pocket Agent Host could not reach Telegram. Check the phone’s network and try again.", severity: "warning" });
      return { ok: false, message: "Pocket Agent Host could not reach Telegram. Check the phone’s network and try again." };
    }
  }, [appendEvent, state.config.allowedChatId]);

  const testModel = useCallback(async (): Promise<ModelTestResult> => {
    const modelApiKey = await readSecret(MODEL_API_KEY);
    const config = state.config;
    if (!modelApiKey || !config.modelEndpoint || !config.modelName) {
      return { ok: false, message: "Save an HTTPS endpoint, model name, and protected model credential before testing." };
    }
    const result = await preflightNativeModel({ modelEndpoint: config.modelEndpoint, modelApiKey, modelName: config.modelName });
    if (!result) {
      return { ok: false, message: "Model preflight requires the installed Android APK. Web preview does not run the private Python runtime." };
    }
    appendEvent({ title: result.ok ? "Model endpoint verified" : "Model endpoint check failed", detail: result.reason, severity: result.ok ? "success" : "warning" });
    return { ok: result.ok, message: result.reason };
  }, [appendEvent, state.config]);

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
    await Promise.all([deleteSecret(TELEGRAM_TOKEN_KEY), deleteSecret(MODEL_API_KEY), clearNativeSupervisorConfiguration()]);
    setState((current) => ({
      ...current,
      config: { ...current.config, hasTelegramToken: false, hasModelApiKey: false },
      modelCatalog: [],
      modelCatalogFetchedAt: null,
      providerConnection: initialState.providerConnection,
      phase: "unconfigured",
      events: [{ id: createId("event"), title: "Sensitive configuration removed", detail: "Telegram and model credentials were removed from protected storage. The native host cannot restart until they are saved again.", severity: "warning" as const, createdAt: new Date().toISOString() }, ...current.events].slice(0, 60),
    }));
  }, []);

  const value = useMemo<PocketHermesContextValue>(() => ({ ...state, hydrated, saveConfiguration, testGateway, sendTestMessage, testModel, discoverModels, testProviderConnection, saveMcpServer, removeMcpServer, setMcpServerEnabled, approveMcpTool, revokeMcpToolApproval, toggleFavoriteModel, isFavoriteModel, prepareRuntime, stopHost, addAutomation, setAutomationEnabled, addDraft, clearActivity, clearSensitiveConfiguration }), [state, hydrated, saveConfiguration, testGateway, sendTestMessage, testModel, discoverModels, testProviderConnection, saveMcpServer, removeMcpServer, setMcpServerEnabled, approveMcpTool, revokeMcpToolApproval, toggleFavoriteModel, isFavoriteModel, prepareRuntime, stopHost, addAutomation, setAutomationEnabled, addDraft, clearActivity, clearSensitiveConfiguration]);
  return <PocketHermesContext.Provider value={value}>{children}</PocketHermesContext.Provider>;
}

export function usePocketHermes() {
  const context = useContext(PocketHermesContext);
  if (!context) throw new Error("usePocketHermes must be used inside PocketHermesProvider");
  return context;
}
