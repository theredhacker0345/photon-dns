import { Platform } from "react-native";

import PocketHermesSupervisorModule, {
  type NativeSupervisorStartConfig,
} from "@/modules/pocket-hermes-supervisor/src/PocketHermesSupervisorModule";
import { formatTelemetryBytes, normalizeSupervisorTelemetry, type SupervisorTelemetry } from "./supervisor-telemetry";

export type { SupervisorTelemetry } from "./supervisor-telemetry";

/**
 * Reads real Android process telemetry from the FOSS foreground supervisor.
 * Expo web preview intentionally resolves to null because it has no Android
 * process, foreground service, or embedded Hermes runtime.
 */
export async function getSupervisorTelemetry(): Promise<SupervisorTelemetry | null> {
  if (Platform.OS === "web") return null;
  try {
    const raw = await PocketHermesSupervisorModule.getTelemetry();
    return normalizeSupervisorTelemetry(raw);
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
  return formatTelemetryBytes(bytes);
}
