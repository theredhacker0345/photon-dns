import type { NativeModelPreflight, NativeSupervisorDiagnostic, NativeSupervisorHealth, NativeSupervisorStartConfig, NativeSupervisorTask, NativeSupervisorTelemetry } from "./PocketHermesSupervisorModule";

const unavailable = new Error("The Pocket Hermes Android supervisor is unavailable in web preview.");

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
};

export default PocketHermesSupervisorModule;
