import { requireNativeModule } from "expo-modules-core";

export type NativeSupervisorTelemetry = {
  agentStatus: "running" | "starting" | "degraded" | "stopped";
  cpuPercent: number;
  ramUsedBytes: number;
  ramTotalBytes: number;
  sampledAt: string;
};

type SupervisorModule = {
  getTelemetry(): Promise<NativeSupervisorTelemetry>;
  startSupervisor(): Promise<{ status: "starting" }>;
  stopSupervisor(): Promise<{ status: "stopped" }>;
};

export default requireNativeModule<SupervisorModule>("PocketHermesSupervisor");
