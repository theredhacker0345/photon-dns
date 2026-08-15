import { NativeModules, Platform } from "react-native";

export type SupervisorTelemetry = {
  agentStatus: "running" | "starting" | "degraded" | "stopped";
  cpuPercent: number;
  ramUsedBytes: number;
  ramTotalBytes: number;
  sampledAt: string;
  source: "native";
};

type NativeSupervisorModule = {
  getTelemetry: () => Promise<Omit<SupervisorTelemetry, "source">>;
};

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function normalizeStatus(value: unknown): SupervisorTelemetry["agentStatus"] {
  return value === "running" || value === "starting" || value === "degraded" || value === "stopped" ? value : "degraded";
}

/**
 * Bridge to the Kotlin PocketHermesSupervisor module included in the custom Android build.
 * Expo preview deliberately returns null: it cannot host the embedded Hermes runtime.
 */
export async function getSupervisorTelemetry(): Promise<SupervisorTelemetry | null> {
  if (Platform.OS === "web") return null;
  const module = NativeModules.PocketHermesSupervisor as NativeSupervisorModule | undefined;
  if (!module?.getTelemetry) return null;
  try {
    const raw = await module.getTelemetry();
    if (!isFiniteNonNegative(raw.cpuPercent) || !isFiniteNonNegative(raw.ramUsedBytes) || !isFiniteNonNegative(raw.ramTotalBytes) || raw.ramTotalBytes === 0) return null;
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

export function formatBytes(bytes: number) {
  const gigabytes = bytes / 1024 / 1024 / 1024;
  return gigabytes >= 1 ? `${gigabytes.toFixed(1)} GB` : `${Math.round(bytes / 1024 / 1024)} MB`;
}
