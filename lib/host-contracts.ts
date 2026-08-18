/**
 * Cross-layer contract for the Pocket Relay host.
 *
 * This file is deliberately secret-free. Telegram and model credentials belong
 * exclusively in Android Keystore-backed storage once handed to the native
 * supervisor. Kotlin and Python mirror the discriminated values below.
 */
export const HOST_CONTRACT_VERSION = 1 as const;

export type HostRuntimePolicy = {
  chargingAware: boolean;
  restartAfterBoot: boolean;
  lowBatteryPercent: number;
  minimumFreeStorageBytes: number;
  /** Sustained process CPU threshold; native supervision stops after repeated breaches. */
  maximumCpuPercent: number;
  /** Android process PSS guardrail; native supervision stops immediately on breach. */
  maximumProcessRamBytes: number;
  /** Private Hermes runtime-directory quota; no files are deleted automatically. */
  maximumWorkspaceBytes: number;
  /** Display-only threshold for a visual near-limit warning. */
  warningThresholdPercent: number;
  /** Display-only threshold for a visual critical resource warning. */
  criticalThresholdPercent: number;
};

export const defaultHostRuntimePolicy: HostRuntimePolicy = {
  chargingAware: true,
  restartAfterBoot: false,
  lowBatteryPercent: 20,
  minimumFreeStorageBytes: 2 * 1024 * 1024 * 1024,
  maximumCpuPercent: 65,
  maximumProcessRamBytes: 512 * 1024 * 1024,
  maximumWorkspaceBytes: 512 * 1024 * 1024,
  warningThresholdPercent: 80,
  criticalThresholdPercent: 95,
};

export type ModelProviderId = "openai" | "openrouter" | "groq" | "mistral" | "kilo" | "ollama" | "lmstudio" | "custom";

/**
 * The proxy destination is public metadata; any username/password remains in
 * platform secure storage and is passed only during native runtime launch.
 */
export type TelegramProxyType = "none" | "http" | "socks5";

export type PublicTelegramProxyConfiguration = {
  type: TelegramProxyType;
  host: string;
  port: number | null;
  hasCredentials: boolean;
};

export const defaultTelegramProxyConfiguration: PublicTelegramProxyConfiguration = {
  type: "none",
  host: "",
  port: null,
  hasCredentials: false,
};

export type PublicModelConfiguration = {
  provider: ModelProviderId;
  endpoint: string;
  model: string;
  hasApiKey: boolean;
};

export type PublicHostConfiguration = {
  hostName: string;
  ownerChatId: string;
  telegramConfigured: boolean;
  model: PublicModelConfiguration;
  policy: HostRuntimePolicy;
};

export type WorkerState = "unconfigured" | "stopped" | "starting" | "running" | "degraded" | "stopping";

export type WorkerHealth = {
  contractVersion: typeof HOST_CONTRACT_VERSION;
  state: WorkerState;
  detail: string | null;
  runtimeVersion: string | null;
  lastHeartbeatAt: string | null;
  lastSuccessfulPollAt: string | null;
  restartCount: number;
};

export type HostTaskStatus = "accepted" | "queued" | "running" | "completed" | "failed" | "cancelled" | "delivery_failed";

export type HostTask = {
  id: string;
  source: "telegram" | "console" | "automation";
  status: HostTaskStatus;
  createdAt: string;
  updatedAt: string;
  summary: string;
  detail: string | null;
};

export type HostSchedule = {
  id: string;
  title: string;
  instruction: string;
  expression: string;
  timezone: string;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastResult: "none" | "completed" | "failed" | "skipped";
  retryCount: number;
};

export type HostDiagnostic = {
  id: string;
  occurredAt: string;
  category: "lifecycle" | "telegram" | "model" | "task" | "schedule" | "policy" | "storage";
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
};

const httpsUrl = /^https:\/\//i;

const safeProxyHostname = /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)$/;

export function isSafeTelegramProxyConfiguration(proxy: PublicTelegramProxyConfiguration) {
  if (proxy.type === "none") return proxy.host.trim() === "" && proxy.port === null;
  const host = proxy.host.trim();
  const port = proxy.port;
  if (!host || !Number.isInteger(port) || !port || port < 1 || port > 65_535) return false;
  if (host.includes("/") || host.includes("@") || host.includes(":")) return false;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  return ipv4 ? ipv4.slice(1).every((part) => Number(part) <= 255) : safeProxyHostname.test(host);
}

export function isLocalNetworkProvider(provider: ModelProviderId) {
  return provider === "ollama" || provider === "lmstudio";
}

export function requiresModelApiKey(provider: ModelProviderId) {
  return !isLocalNetworkProvider(provider);
}

function isPrivateNetworkAddress(hostname: string) {
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.some((octet) => octet > 255)) return false;
    return octets[0] === 10
      || octets[0] === 127
      || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
      || (octets[0] === 192 && octets[1] === 168)
      || (octets[0] === 169 && octets[1] === 254);
  }
  const normalized = hostname.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

/**
 * Hosted providers require explicit credential-free HTTPS URLs. Ollama and LM
 * Studio may instead use HTTP only when the owner enters a numeric private-LAN
 * address; DNS names are intentionally rejected to avoid silently widening an
 * insecure local-provider route beyond the owner-controlled network.
 */
export function isAllowedModelEndpoint(endpoint: string, provider: ModelProviderId = "custom") {
  const candidate = endpoint.trim();
  if (!candidate) return false;
  try {
    const parsed = new URL(candidate);
    if (parsed.username || parsed.password || !parsed.hostname) return false;
    if (parsed.protocol === "https:") return true;
    return parsed.protocol === "http:" && isLocalNetworkProvider(provider) && isPrivateNetworkAddress(parsed.hostname);
  } catch {
    return false;
  }
}

export function isSafeRuntimePolicy(policy: HostRuntimePolicy) {
  return Number.isInteger(policy.lowBatteryPercent)
    && policy.lowBatteryPercent >= 5
    && policy.lowBatteryPercent <= 80
    && Number.isSafeInteger(policy.minimumFreeStorageBytes)
    && policy.minimumFreeStorageBytes >= 512 * 1024 * 1024
    && Number.isInteger(policy.maximumCpuPercent)
    && policy.maximumCpuPercent >= 10
    && policy.maximumCpuPercent <= 95
    && Number.isSafeInteger(policy.maximumProcessRamBytes)
    && policy.maximumProcessRamBytes >= 128 * 1024 * 1024
    && policy.maximumProcessRamBytes <= 8 * 1024 * 1024 * 1024
    && Number.isSafeInteger(policy.maximumWorkspaceBytes)
    && policy.maximumWorkspaceBytes >= 64 * 1024 * 1024
    && policy.maximumWorkspaceBytes <= 8 * 1024 * 1024 * 1024
    && Number.isInteger(policy.warningThresholdPercent)
    && policy.warningThresholdPercent >= 50
    && policy.warningThresholdPercent <= 90
    && Number.isInteger(policy.criticalThresholdPercent)
    && policy.criticalThresholdPercent > policy.warningThresholdPercent
    && policy.criticalThresholdPercent <= 99;
}

export function isTerminalTaskStatus(status: HostTaskStatus) {
  return status === "completed" || status === "failed" || status === "cancelled" || status === "delivery_failed";
}

export function canStartWorker(config: PublicHostConfiguration) {
  return Boolean(config.model.provider)
    && config.telegramConfigured
    && Boolean(config.ownerChatId.trim())
    && (!requiresModelApiKey(config.model.provider) || config.model.hasApiKey)
    && Boolean(config.model.model.trim())
    && isAllowedModelEndpoint(config.model.endpoint, config.model.provider)
    && isSafeRuntimePolicy(config.policy);
}

export type HostReadinessSnapshot = {
  source: "native" | "preview" | "unavailable";
  isCharging: boolean | null;
  freeStorageBytes: number | null;
};

/**
 * UI-side preflight only. Android repeats this check at service start and boot
 * recovery, so the policy cannot be bypassed by a stale JavaScript snapshot.
 */
export function getRuntimePolicyBlock(policy: HostRuntimePolicy, readiness: HostReadinessSnapshot): string | null {
  if (readiness.source !== "native") return null;
  if (readiness.freeStorageBytes !== null && readiness.freeStorageBytes < policy.minimumFreeStorageBytes) {
    return "Free storage is below this host’s configured runtime reserve.";
  }
  if (policy.chargingAware && readiness.isCharging !== true) {
    return "This host is configured to run only while the phone is charging.";
  }
  return null;
}
