/**
 * Cross-layer contract for the Pocket Hermes host.
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
};

export const defaultHostRuntimePolicy: HostRuntimePolicy = {
  chargingAware: true,
  restartAfterBoot: false,
  lowBatteryPercent: 20,
  minimumFreeStorageBytes: 2 * 1024 * 1024 * 1024,
};

export type PublicModelConfiguration = {
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

/** A model endpoint must be explicit HTTPS and must not contain user credentials. */
export function isAllowedModelEndpoint(endpoint: string) {
  const candidate = endpoint.trim();
  if (!candidate || !httpsUrl.test(candidate)) return false;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export function isSafeRuntimePolicy(policy: HostRuntimePolicy) {
  return Number.isInteger(policy.lowBatteryPercent)
    && policy.lowBatteryPercent >= 5
    && policy.lowBatteryPercent <= 80
    && Number.isSafeInteger(policy.minimumFreeStorageBytes)
    && policy.minimumFreeStorageBytes >= 512 * 1024 * 1024;
}

export function isTerminalTaskStatus(status: HostTaskStatus) {
  return status === "completed" || status === "failed" || status === "cancelled" || status === "delivery_failed";
}

export function canStartWorker(config: PublicHostConfiguration) {
  return config.telegramConfigured
    && Boolean(config.ownerChatId.trim())
    && config.model.hasApiKey
    && Boolean(config.model.model.trim())
    && isAllowedModelEndpoint(config.model.endpoint)
    && isSafeRuntimePolicy(config.policy);
}
