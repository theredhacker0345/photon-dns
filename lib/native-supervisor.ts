import { Platform } from "react-native";

import PocketHermesSupervisorModule, {
  type NativeSupervisorStartConfig,
  type NativeSupervisorTelemetry,
} from "@/modules/pocket-hermes-supervisor/src/PocketHermesSupervisorModule";

export type SupervisorTelemetry = NativeSupervisorTelemetry & {
  source: "native";
};

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function normalizeStatus(value: unknown): SupervisorTelemetry["agentStatus"] {
  return value === "running" || value === "starting" || value === "degraded" || value === "stopped" ? value : "degraded";
}

/**
 * Reads real Android process telemetry from the FOSS foreground supervisor.
 * Expo web preview intentionally resolves to null because it has no Android
 * process, foreground service, or embedded Hermes runtime.
 */
export async function getSupervisorTelemetry(): Promise<SupervisorTelemetry | null> {
  if (Platform.OS === "web") return null;
  try {
    const raw = await PocketHermesSupervisorModule.getTelemetry();
    if (
      !isFiniteNonNegative(raw.cpuPercent) ||
      !isFiniteNonNegative(raw.ramUsedBytes) ||
      !isFiniteNonNegative(raw.ramTotalBytes) ||
      raw.ramTotalBytes === 0
    ) {
      return null;
    }
    return {
      agentStatus: normalizeStatus(raw.agentStatus),
      cpuPercent: Math.min(100, Math.round(raw.cpuPercent)),
      ramUsedBytes: raw.ramUsedBytes,
      ramTotalBytes: raw.ramTotalBytes,
      sampledAt: typeof raw.sampledAt === "string" ? raw.sampledAt : new Date().toISOString(),
      source: "native",
    };
  } catch {
    return null;
  }
}

export async function startNativeSupervisor(config: NativeSupervisorStartConfig): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    await PocketHermesSupervisorModule.startSupervisor(config);
    return true;
  } catch {
    return false;
  }
}

export async function stopNativeSupervisor(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    await PocketHermesSupervisorModule.stopSupervisor();
    return true;
  } catch {
    return false;
  }
}

export function formatBytes(bytes: number) {
  const gigabytes = bytes / 1024 / 1024 / 1024;
  return gigabytes >= 1 ? `${gigabytes.toFixed(1)} GB` : `${Math.round(bytes / 1024 / 1024)} MB`;
}
