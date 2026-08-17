import { Platform } from "react-native";

import PocketHermesSupervisorModule, {
  type NativeSupervisorDiagnostic,
  type NativeSupervisorHealth,
  type NativeModelPreflight,
  type NativeSupervisorStartConfig,
  type NativeSupervisorTask,
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

/** Reads secret-free worker lifecycle data. A web preview has no native host. */
export async function getSupervisorHealth(): Promise<NativeSupervisorHealth | null> {
  if (Platform.OS === "web") return null;
  try {
    return await PocketHermesSupervisorModule.getHealth();
  } catch {
    return null;
  }
}

/** Returns bounded, redacted native lifecycle diagnostics for the local owner. */
export async function getSupervisorDiagnostics(): Promise<NativeSupervisorDiagnostic[]> {
  if (Platform.OS === "web") return [];
  try {
    return await PocketHermesSupervisorModule.getDiagnostics();
  } catch {
    return [];
  }
}

/** Adds an owner-local task to the durable Hermes runtime queue on Android. */
export async function enqueueNativeTask(task: { id: string; body: string }): Promise<NativeSupervisorTask | null> {
  if (Platform.OS === "web") return null;
  try {
    return await PocketHermesSupervisorModule.enqueueTask(task);
  } catch {
    return null;
  }
}

/** Reads the bounded task history kept in the private Android application directory. */
export async function listNativeTasks(): Promise<NativeSupervisorTask[]> {
  if (Platform.OS === "web") return [];
  try {
    return await PocketHermesSupervisorModule.listTasks();
  } catch {
    return [];
  }
}

export async function cancelNativeTask(taskId: string): Promise<NativeSupervisorTask | null> {
  if (Platform.OS === "web") return null;
  try {
    return await PocketHermesSupervisorModule.cancelTask(taskId);
  } catch {
    return null;
  }
}

export async function preflightNativeModel(config: Pick<NativeSupervisorStartConfig, "modelEndpoint" | "modelApiKey" | "modelName">): Promise<NativeModelPreflight | null> {
  if (Platform.OS === "web") return null;
  try {
    return await PocketHermesSupervisorModule.preflightModel(config);
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

export async function clearNativeSupervisorConfiguration(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    await PocketHermesSupervisorModule.clearConfiguration();
    return true;
  } catch {
    return false;
  }
}

export function formatBytes(bytes: number) {
  return formatTelemetryBytes(bytes);
}
