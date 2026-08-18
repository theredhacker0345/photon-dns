import type { NativeCodeJobApproval, NativeCodeJobProposal, NativeCodeJobRequest, NativeCodeJobResult, NativeCodeSandboxStatus, NativeModelPreflight, NativeSupervisorDiagnostic, NativeSupervisorHealth, NativeSupervisorSchedule, NativeSupervisorScheduleInput, NativeSupervisorScheduleRun, NativeSupervisorStartConfig, NativeSupervisorTask, NativeSupervisorTelemetry } from "./PocketHermesSupervisorModule";

const unavailable = new Error("The Pocket Agent Host Android supervisor is unavailable in web preview.");

const PocketHermesSupervisorModule = {
  async getTelemetry(): Promise<NativeSupervisorTelemetry> {
    throw unavailable;
  },
  async getHealth(): Promise<NativeSupervisorHealth> {
    throw unavailable;
  },
  async getDiagnostics(): Promise<NativeSupervisorDiagnostic[]> {
    throw unavailable;
  },
  async enqueueTask(_task: { id: string; body: string }): Promise<NativeSupervisorTask> {
    throw unavailable;
  },
  async listTasks(): Promise<NativeSupervisorTask[]> {
    throw unavailable;
  },
  async cancelTask(_taskId: string): Promise<NativeSupervisorTask> {
    throw unavailable;
  },
  async upsertSchedule(_schedule: NativeSupervisorScheduleInput): Promise<NativeSupervisorSchedule> {
    throw unavailable;
  },
  async listSchedules(): Promise<NativeSupervisorSchedule[]> {
    throw unavailable;
  },
  async setScheduleEnabled(_scheduleId: string, _enabled: boolean): Promise<NativeSupervisorSchedule> {
    throw unavailable;
  },
  async deleteSchedule(_scheduleId: string): Promise<{ status: "deleted" }> {
    throw unavailable;
  },
  async listScheduleRuns(): Promise<NativeSupervisorScheduleRun[]> {
    throw unavailable;
  },
  async preflightModel(_config: Pick<NativeSupervisorStartConfig, "modelEndpoint" | "modelApiKey" | "modelName">): Promise<NativeModelPreflight> {
    throw unavailable;
  },
  async startSupervisor(_config: NativeSupervisorStartConfig): Promise<{ status: "starting" }> {
    throw unavailable;
  },
  async stopSupervisor(): Promise<{ status: "stopped" }> {
    throw unavailable;
  },
  async clearConfiguration(): Promise<{ status: "cleared" }> {
    throw unavailable;
  },
  async getCodeSandboxStatus(): Promise<NativeCodeSandboxStatus> {
    throw unavailable;
  },
  async setCodeSandboxEnabled(_enabled: boolean): Promise<NativeCodeSandboxStatus> {
    throw unavailable;
  },
  async proposeCodeJob(_source: string): Promise<NativeCodeJobProposal> {
    throw unavailable;
  },
  async approveCodeJob(_source: string): Promise<NativeCodeJobApproval> {
    throw unavailable;
  },
  async revokeCodeJob(_sourceHash: string): Promise<NativeCodeJobApproval> {
    throw unavailable;
  },
  async runApprovedCodeJob(_request: NativeCodeJobRequest): Promise<NativeCodeJobResult> {
    throw unavailable;
  },
};

export default PocketHermesSupervisorModule;
