import { requireNativeModule } from "expo-modules-core";

export type NativeSupervisorTelemetry = {
  agentStatus: "running" | "starting" | "degraded" | "stopped";
  cpuPercent: number;
  ramUsedBytes: number;
  ramTotalBytes: number;
  sampledAt: string;
};

export type NativeSupervisorHealth = {
  state: "running" | "starting" | "degraded" | "stopped";
  detail: string | null;
  lastHeartbeatAt: string | null;
  restartCount: number;
};

export type NativeSupervisorDiagnostic = {
  occurredAt: string;
  category: "lifecycle" | "telegram" | "model" | "task" | "schedule" | "policy" | "storage";
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
};

export type NativeModelPreflight = { ok: boolean; reason: string };

export type NativeSupervisorTask = {
  id: string;
  body: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  result: string | null;
  reason: string | null;
};

export type NativeSupervisorStartConfig = {
  telegramToken: string;
  ownerChatId: string;
  modelEndpoint?: string;
  modelApiKey?: string;
  modelName?: string;
  restartAfterBoot?: boolean;
};

type SupervisorModule = {
  getTelemetry(): Promise<NativeSupervisorTelemetry>;
  getHealth(): Promise<NativeSupervisorHealth>;
  getDiagnostics(): Promise<NativeSupervisorDiagnostic[]>;
  enqueueTask(task: { id: string; body: string }): Promise<NativeSupervisorTask>;
  listTasks(): Promise<NativeSupervisorTask[]>;
  cancelTask(taskId: string): Promise<NativeSupervisorTask>;
  preflightModel(config: Pick<NativeSupervisorStartConfig, "modelEndpoint" | "modelApiKey" | "modelName">): Promise<NativeModelPreflight>;
  startSupervisor(config: NativeSupervisorStartConfig): Promise<{ status: "starting" }>;
  stopSupervisor(): Promise<{ status: "stopped" }>;
  clearConfiguration(): Promise<{ status: "cleared" }>;
};

export default requireNativeModule<SupervisorModule>("PocketHermesSupervisor");
