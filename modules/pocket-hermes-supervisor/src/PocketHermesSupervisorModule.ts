import { requireNativeModule } from "expo-modules-core";

export type NativeSupervisorTelemetry = {
  agentStatus: "running" | "starting" | "degraded" | "stopped";
  cpuPercent: number;
  cpuCoreCount: number;
  ramUsedBytes: number;
  ramTotalBytes: number;
  storageFreeBytes: number;
  workspaceUsedBytes: number;
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

/** Secret-free active owner-session context measurement from the embedded Hermes runtime. */
export type NativeSupervisorContext = {
  available: boolean;
  modelName: string | null;
  usedTokens: number;
  totalTokens: number;
  percentage: number;
  headroomTokens: number;
  thresholdTokens: number;
  compressionCount: number;
  reason: string | null;
};

/** Result of an owner-requested Hermes `/compress` operation. */
export type NativeSupervisorContextCompression = {
  ok: boolean;
  message: string;
  context: NativeSupervisorContext;
};

export type NativeSupervisorTask = {
  id: string;
  body: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  result: string | null;
  reason: string | null;
};

export type NativeSupervisorSchedule = {
  id: string;
  title: string;
  expression: string;
  body: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: "queued" | "retrying" | "succeeded" | "failed" | null;
  nextRetryAt: string | null;
};

export type NativeSupervisorScheduleRun = {
  id: string;
  scheduleId: string;
  scheduleTitle: string;
  status: "queued" | "running" | "retrying" | "succeeded" | "failed";
  attempt: number;
  createdAt: string;
  updatedAt: string;
  reason: string | null;
};

export type NativeSupervisorScheduleInput = Pick<NativeSupervisorSchedule, "id" | "title" | "expression" | "body" | "enabled">;

/** Secret-free status of the Android-only, owner-gated QuickJS executor. */
export type NativeCodeSandboxStatus = {
  enabled: boolean;
  activeApprovals: number;
  defaultTimeoutMs: number;
  defaultMemoryBytes: number;
  defaultMaxOutputBytes: number;
};

export type NativeCodeJobProposal = { hash: string; sourceBytes: number; approvalRequired: boolean };
export type NativeCodeJobApproval = { hash: string; expiresAt: string; approved?: boolean; revoked?: boolean };
export type NativeCodeJobResult = {
  hash: string;
  status: "ok" | "error" | "timeout" | "rejected";
  output: string;
  truncated: boolean;
  timedOut: boolean;
  occurredAt: string;
};
export type NativeCodeJobRequest = { source: string; timeoutMs?: string; memoryBytes?: string; maxOutputBytes?: string };

export type NativeSupervisorStartConfig = {
  telegramToken: string;
  ownerChatId: string;
  modelEndpoint?: string;
  modelApiKey?: string;
  modelName?: string;
  /** Protected JSON payload assembled at launch time; never persisted in JS state. */
  mcpConfigJson?: string;
  restartAfterBoot?: boolean;
  chargingAware?: boolean;
  lowBatteryPercent?: number;
  minimumFreeStorageBytes?: number;
  maximumCpuPercent?: number;
  maximumProcessRamBytes?: number;
  maximumWorkspaceBytes?: number;
};

type SupervisorModule = {
  getTelemetry(): Promise<NativeSupervisorTelemetry>;
  getHealth(): Promise<NativeSupervisorHealth>;
  getDiagnostics(): Promise<NativeSupervisorDiagnostic[]>;
  getContextStatus(): Promise<NativeSupervisorContext>;
  compressContext(): Promise<NativeSupervisorContextCompression>;
  enqueueTask(task: { id: string; body: string }): Promise<NativeSupervisorTask>;
  listTasks(): Promise<NativeSupervisorTask[]>;
  cancelTask(taskId: string): Promise<NativeSupervisorTask>;
  upsertSchedule(schedule: NativeSupervisorScheduleInput): Promise<NativeSupervisorSchedule>;
  listSchedules(): Promise<NativeSupervisorSchedule[]>;
  setScheduleEnabled(scheduleId: string, enabled: boolean): Promise<NativeSupervisorSchedule>;
  deleteSchedule(scheduleId: string): Promise<{ status: "deleted" }>;
  listScheduleRuns(): Promise<NativeSupervisorScheduleRun[]>;
  preflightModel(config: Pick<NativeSupervisorStartConfig, "modelEndpoint" | "modelApiKey" | "modelName">): Promise<NativeModelPreflight>;
  startSupervisor(config: NativeSupervisorStartConfig): Promise<{ status: "starting" }>;
  updateMcpRuntimeConfig(mcpConfigJson?: string): Promise<{ status: "updated" }>;
  stopSupervisor(): Promise<{ status: "stopped" }>;
  clearConfiguration(): Promise<{ status: "cleared" }>;
  getCodeSandboxStatus(): Promise<NativeCodeSandboxStatus>;
  setCodeSandboxEnabled(enabled: boolean): Promise<NativeCodeSandboxStatus>;
  proposeCodeJob(source: string): Promise<NativeCodeJobProposal>;
  approveCodeJob(source: string): Promise<NativeCodeJobApproval>;
  revokeCodeJob(sourceHash: string): Promise<NativeCodeJobApproval>;
  runApprovedCodeJob(request: NativeCodeJobRequest): Promise<NativeCodeJobResult>;
};

export default requireNativeModule<SupervisorModule>("PocketHermesSupervisor");
