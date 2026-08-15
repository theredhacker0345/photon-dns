import type { NativeSupervisorTelemetry } from "./PocketHermesSupervisorModule";

const unavailable = new Error("The Pocket Hermes Android supervisor is unavailable in web preview.");

const PocketHermesSupervisorModule = {
  async getTelemetry(): Promise<NativeSupervisorTelemetry> {
    throw unavailable;
  },
  async startSupervisor(): Promise<{ status: "starting" }> {
    throw unavailable;
  },
  async stopSupervisor(): Promise<{ status: "stopped" }> {
    throw unavailable;
  },
};

export default PocketHermesSupervisorModule;
