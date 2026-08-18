import { Platform } from "react-native";

import PocketHermesSupervisorModule, {
  type NativeCodeAuditEntry,
  type NativeCodeJobApproval,
  type NativeCodeJobProposal,
  type NativeCodeJobRequest,
  type NativeCodeJobResult,
  type NativeCodeSandboxStatus,
  type NativeModelPreflight,
  type NativeSupervisorContext,
  type NativeSupervisorContextCompression,
  type NativeSupervisorDiagnostic,
  type NativeSupervisorHealth,
  type NativeSupervisorSchedule,
  type NativeSupervisorScheduleInput,
  type NativeSupervisorScheduleRun,
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

/** Reads only the active owner session's token-window metadata; no transcript leaves the runtime. */
export async function getNativeContextStatus(): Promise<NativeSupervisorContext | null> {
  if (Platform.OS === "web") return null;
  try {
    return await PocketHermesSupervisorModule.getContextStatus();
  } catch {
    return null;
  }
}

/** Runs Hermes' supported owner-session manual compression path on Android. */
export async function compressNativeContext(): Promise<NativeSupervisorContextCompression | null> {
  if (Platform.OS === "web") return null;
  try {
    return await PocketHermesSupervisorModule.compressContext();
  } catch {
    return null;
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

/** Saves a validated, owner-only schedule in Android private storage. */
export async function upsertNativeSchedule(schedule: NativeSupervisorScheduleInput): Promise<NativeSupervisorSchedule | null> {
  if (Platform.OS === "web") return null;
  try {
    return await PocketHermesSupervisorModule.upsertSchedule(schedule);
  } catch {
    return null;
  }
}

export async function listNativeSchedules(): Promise<NativeSupervisorSchedule[]> {
  if (Platform.OS === "web") return [];
  try {
    return await PocketHermesSupervisorModule.listSchedules();
  } catch {
    return [];
  }
}

export async function setNativeScheduleEnabled(scheduleId: string, enabled: boolean): Promise<NativeSupervisorSchedule | null> {
  if (Platform.OS === "web") return null;
  try {
    return await PocketHermesSupervisorModule.setScheduleEnabled(scheduleId, enabled);
  } catch {
    return null;
  }
}

export async function deleteNativeSchedule(scheduleId: string): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    await PocketHermesSupervisorModule.deleteSchedule(scheduleId);
    return true;
  } catch {
    return false;
  }
}

export async function listNativeScheduleRuns(): Promise<NativeSupervisorScheduleRun[]> {
  if (Platform.OS === "web") return [];
  try {
    return await PocketHermesSupervisorModule.listScheduleRuns();
  } catch {
    return [];
  }
}

export async function preflightNativeModel(config: Pick<NativeSupervisorStartConfig, "modelProvider" | "modelEndpoint" | "modelApiKey" | "modelName">): Promise<NativeModelPreflight | null> {
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

/** Updates only the encrypted, approval-scoped remote MCP runtime payload on Android. */
export async function updateNativeMcpRuntimeConfig(mcpConfigJson?: string): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    await PocketHermesSupervisorModule.updateMcpRuntimeConfig(mcpConfigJson);
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

/** Reads Android-only code-execution policy. Web preview intentionally cannot simulate this boundary. */
export async function getNativeCodeSandboxStatus(): Promise<NativeCodeSandboxStatus | null> {
  if (Platform.OS === "web") return null;
  try {
    return await PocketHermesSupervisorModule.getCodeSandboxStatus();
  } catch {
    return null;
  }
}

export async function setNativeCodeSandboxEnabled(enabled: boolean): Promise<NativeCodeSandboxStatus | null> {
  if (Platform.OS === "web") return null;
  try {
    return await PocketHermesSupervisorModule.setCodeSandboxEnabled(enabled);
  } catch {
    return null;
  }
}

/** Reads bounded, redacted QuickJS history; source and raw execution output are never returned. */
export async function listNativeCodeAuditLog(): Promise<NativeCodeAuditEntry[]> {
  if (Platform.OS === "web") return [];
  try {
    return await PocketHermesSupervisorModule.listCodeAuditLog();
  } catch {
    return [];
  }
}

export async function proposeNativeCodeJob(source: string): Promise<NativeCodeJobProposal | null> {
  if (Platform.OS === "web") return null;
  try {
    return await PocketHermesSupervisorModule.proposeCodeJob(source);
  } catch {
    return null;
  }
}

export async function approveNativeCodeJob(source: string): Promise<NativeCodeJobApproval | null> {
  if (Platform.OS === "web") return null;
  try {
    return await PocketHermesSupervisorModule.approveCodeJob(source);
  } catch {
    return null;
  }
}

export async function revokeNativeCodeJob(sourceHash: string): Promise<NativeCodeJobApproval | null> {
  if (Platform.OS === "web") return null;
  try {
    return await PocketHermesSupervisorModule.revokeCodeJob(sourceHash);
  } catch {
    return null;
  }
}

export async function runNativeApprovedCodeJob(request: NativeCodeJobRequest): Promise<NativeCodeJobResult | null> {
  if (Platform.OS === "web") return null;
  try {
    return await PocketHermesSupervisorModule.runApprovedCodeJob(request);
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number) {
  return formatTelemetryBytes(bytes);
}
