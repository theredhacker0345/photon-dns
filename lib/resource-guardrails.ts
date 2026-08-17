import type { HostRuntimePolicy } from "./host-contracts";
import { formatTelemetryBytes, type SupervisorTelemetry } from "./supervisor-telemetry";

const MEBIBYTE = 1024 * 1024;
const GIBIBYTE = 1024 * MEBIBYTE;
const RECOMMENDATION_INCREMENT_BYTES = 64 * MEBIBYTE;
const WARNING_RATIO = 0.8;
const CRITICAL_RATIO = 0.95;

export type ResourceGuardrail = "cpu" | "ram" | "workspace";

export type ResourceLimitWarning = {
  resource: ResourceGuardrail;
  severity: "warning" | "critical";
  title: string;
  detail: string;
  ratio: number;
};

export type RecommendedResourceLimits = Pick<HostRuntimePolicy, "maximumCpuPercent" | "maximumProcessRamBytes" | "maximumWorkspaceBytes"> & {
  deviceSummary: string;
};

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function roundDownToIncrement(bytes: number) {
  return Math.floor(bytes / RECOMMENDATION_INCREMENT_BYTES) * RECOMMENDATION_INCREMENT_BYTES;
}

function limitWarning({ resource, used, limit, title, detail }: { resource: ResourceGuardrail; used: number; limit: number; title: string; detail: (usedLabel: string, limitLabel: string) => string }): ResourceLimitWarning | null {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return null;
  const ratio = used / limit;
  if (ratio < WARNING_RATIO) return null;
  return {
    resource,
    severity: ratio >= CRITICAL_RATIO ? "critical" : "warning",
    title,
    detail: detail(resource === "cpu" ? `${Math.round(used)}%` : formatTelemetryBytes(used), resource === "cpu" ? `${Math.round(limit)}%` : formatTelemetryBytes(limit)),
    ratio,
  };
}

/**
 * Derives display-only warnings from the private host process and workspace.
 * A missing native reading intentionally produces no warning rather than a
 * fabricated value. Android remains the enforcement authority.
 */
export function getResourceLimitWarnings({ telemetry, policy }: { telemetry: SupervisorTelemetry | null; policy: HostRuntimePolicy }): ResourceLimitWarning[] {
  if (!telemetry) return [];
  return [
    limitWarning({ resource: "cpu", used: telemetry.cpuPercent, limit: policy.maximumCpuPercent, title: "CPU guardrail nearing", detail: (used, limit) => `Host process is at ${used}; the sustained guardrail is ${limit}.` }),
    limitWarning({ resource: "ram", used: telemetry.ramUsedBytes, limit: policy.maximumProcessRamBytes, title: "RAM guardrail nearing", detail: (used, limit) => `Host process is using ${used}; the guardrail is ${limit}.` }),
    isPositiveFinite(telemetry.workspaceUsedBytes)
      ? limitWarning({ resource: "workspace", used: telemetry.workspaceUsedBytes, limit: policy.maximumWorkspaceBytes, title: "Workspace quota nearing", detail: (used, limit) => `Private workspace uses ${used}; the quota is ${limit}.` })
      : null,
  ].filter((warning): warning is ResourceLimitWarning => warning !== null);
}

/**
 * Produces conservative, bounded defaults from Android-reported hardware.
 * CPU is intentionally capped below full-device saturation, RAM is limited to
 * a small process share, and storage uses only a fraction of free capacity
 * after the owner's required runtime reserve.
 */
export function getRecommendedResourceLimits({ telemetry, policy }: { telemetry: SupervisorTelemetry | null; policy: HostRuntimePolicy }): RecommendedResourceLimits | null {
  if (!telemetry || !isPositiveFinite(telemetry.cpuCoreCount) || !isPositiveFinite(telemetry.ramTotalBytes) || !isPositiveFinite(telemetry.storageFreeBytes)) return null;

  const maximumCpuPercent = Math.round(Math.min(70, Math.max(35, (200 / telemetry.cpuCoreCount))));
  const maximumProcessRamBytes = Math.min(GIBIBYTE, Math.max(128 * MEBIBYTE, roundDownToIncrement(telemetry.ramTotalBytes * 0.125)));
  const freeAfterReserve = Math.max(0, telemetry.storageFreeBytes - policy.minimumFreeStorageBytes);
  const maximumWorkspaceBytes = Math.min(GIBIBYTE, Math.max(64 * MEBIBYTE, roundDownToIncrement(freeAfterReserve * 0.15)));

  return {
    maximumCpuPercent,
    maximumProcessRamBytes,
    maximumWorkspaceBytes,
    deviceSummary: `${telemetry.cpuCoreCount} CPU cores · ${formatTelemetryBytes(telemetry.ramTotalBytes)} RAM · ${formatTelemetryBytes(telemetry.storageFreeBytes)} free storage`,
  };
}
