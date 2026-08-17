import type { HostRuntimePolicy } from "./host-contracts";
import type { SupervisorTelemetry } from "./supervisor-telemetry";

export const MAX_RESOURCE_HISTORY_SAMPLES = 30;

export type ResourceHistorySample = {
  sampledAt: string;
  cpuPercent: number;
  ramPercent: number;
  workspacePercent: number | null;
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Converts a trusted native reading to display-only percentages. Workspace is
 * intentionally measured against the owner's private quota rather than device
 * storage, because the app never scans unrelated phone files.
 */
export function getResourceHistorySample({ telemetry, policy }: { telemetry: SupervisorTelemetry; policy: HostRuntimePolicy }): ResourceHistorySample {
  return {
    sampledAt: telemetry.sampledAt,
    cpuPercent: clampPercent(telemetry.cpuPercent),
    ramPercent: clampPercent((telemetry.ramUsedBytes / telemetry.ramTotalBytes) * 100),
    workspacePercent: typeof telemetry.workspaceUsedBytes === "number"
      ? clampPercent((telemetry.workspaceUsedBytes / policy.maximumWorkspaceBytes) * 100)
      : null,
  };
}

/** Keeps a small, volatile dashboard history. Samples never enter task logs or persistent storage. */
export function appendResourceHistory(history: ResourceHistorySample[], sample: ResourceHistorySample, maximumSamples = MAX_RESOURCE_HISTORY_SAMPLES) {
  const existing = history.findIndex((item) => item.sampledAt === sample.sampledAt);
  const next = existing === -1
    ? [...history, sample]
    : history.map((item, index) => index === existing ? sample : item);
  return next.slice(-Math.max(1, maximumSamples));
}
