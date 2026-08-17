export type SupervisorTelemetry = {
  agentStatus: "running" | "starting" | "degraded" | "stopped";
  cpuPercent: number;
  cpuCoreCount?: number;
  ramUsedBytes: number;
  ramTotalBytes: number;
  storageFreeBytes?: number;
  workspaceUsedBytes?: number;
  sampledAt: string;
  source: "native";
};

export type SupervisorTelemetryStatus = "loading" | "sampling" | "live" | "stale" | "bridge-required";

type NativeTelemetryCandidate = {
  agentStatus?: unknown;
  cpuPercent?: unknown;
  cpuCoreCount?: unknown;
  ramUsedBytes?: unknown;
  ramTotalBytes?: unknown;
  storageFreeBytes?: unknown;
  workspaceUsedBytes?: unknown;
  sampledAt?: unknown;
};

export type TelemetryPresentation = {
  statusLabel: string;
  cpu: { value: string; detail: string };
  ram: { value: string; detail: string };
  notice: string | null;
};

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function normalizeStatus(value: unknown): SupervisorTelemetry["agentStatus"] {
  return value === "running" || value === "starting" || value === "degraded" || value === "stopped" ? value : "degraded";
}

function optionalNonNegative(value: unknown): number | undefined {
  return isFiniteNonNegative(value) ? value : undefined;
}

/**
 * Validates a native bridge reading before it is allowed into the UI. A null
 * result is intentional: the dashboard must not substitute invented CPU/RAM
 * numbers when Android has not provided a trustworthy sample.
 */
export function normalizeSupervisorTelemetry(raw: unknown, fallbackSampledAt = new Date().toISOString()): SupervisorTelemetry | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as NativeTelemetryCandidate;
  if (
    !isFiniteNonNegative(candidate.cpuPercent) ||
    !isFiniteNonNegative(candidate.ramUsedBytes) ||
    !isFiniteNonNegative(candidate.ramTotalBytes) ||
    candidate.ramTotalBytes === 0 ||
    candidate.ramUsedBytes > candidate.ramTotalBytes
  ) {
    return null;
  }

  return {
    agentStatus: normalizeStatus(candidate.agentStatus),
    cpuPercent: Math.min(100, Math.round(candidate.cpuPercent)),
    cpuCoreCount: optionalNonNegative(candidate.cpuCoreCount),
    ramUsedBytes: candidate.ramUsedBytes,
    ramTotalBytes: candidate.ramTotalBytes,
    storageFreeBytes: optionalNonNegative(candidate.storageFreeBytes),
    workspaceUsedBytes: optionalNonNegative(candidate.workspaceUsedBytes),
    sampledAt: normalizeSampledAt(candidate.sampledAt, fallbackSampledAt),
    source: "native",
  };
}

function normalizeSampledAt(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const epochMillis = Number(value);
  if (Number.isFinite(epochMillis) && epochMillis > 0) return new Date(epochMillis).toISOString();
  return Number.isFinite(Date.parse(value)) ? value : fallback;
}

export function isSupervisorTelemetryFresh(telemetry: SupervisorTelemetry, now = Date.now()) {
  const sampledAt = Date.parse(telemetry.sampledAt);
  return Number.isFinite(sampledAt) && now - sampledAt <= 45_000;
}

export function formatTelemetryBytes(bytes: number) {
  const gigabytes = bytes / 1024 / 1024 / 1024;
  return gigabytes >= 1 ? `${gigabytes.toFixed(1)} GB` : `${Math.round(bytes / 1024 / 1024)} MB`;
}

/**
 * Converts bridge state into the strings shown on Home. The browser preview
 * remains deliberately honest: it does not have an Android process to sample.
 */
export function getSupervisorTelemetryPresentation({
  telemetry,
  status,
  platform,
}: {
  telemetry: SupervisorTelemetry | null;
  status: SupervisorTelemetryStatus;
  platform: string;
}): TelemetryPresentation {
  if (telemetry && status === "live") {
    return {
      statusLabel: "Live supervisor",
      cpu: { value: `${telemetry.cpuPercent}%`, detail: "Live host-process usage" },
      ram: { value: formatTelemetryBytes(telemetry.ramUsedBytes), detail: `of ${formatTelemetryBytes(telemetry.ramTotalBytes)}` },
      notice: null,
    };
  }

  if (telemetry && status === "sampling") {
    return {
      statusLabel: "Sampling supervisor",
      cpu: { value: "Sampling…", detail: "Calculating CPU baseline" },
      ram: { value: formatTelemetryBytes(telemetry.ramUsedBytes), detail: `of ${formatTelemetryBytes(telemetry.ramTotalBytes)}` },
      notice: "The first Android CPU reading establishes a baseline. Live CPU updates begin within 12 seconds.",
    };
  }

  if (telemetry && status === "stale") {
    return {
      statusLabel: "Supervisor stale",
      cpu: { value: "Stale", detail: "Waiting for Android refresh" },
      ram: { value: formatTelemetryBytes(telemetry.ramUsedBytes), detail: "Last known process use" },
      notice: "The Android supervisor has not supplied a fresh sample in 45 seconds. Keep the host app running and check its power policy.",
    };
  }

  if (status === "loading") {
    return {
      statusLabel: "Checking supervisor",
      cpu: { value: "Checking…", detail: "Requesting native sample" },
      ram: { value: "Checking…", detail: "Requesting native sample" },
      notice: null,
    };
  }

  const inWebPreview = platform === "web";
  return {
    statusLabel: inWebPreview ? "Preview mode" : "Awaiting supervisor",
    cpu: { value: inWebPreview ? "Android APK" : "Unavailable", detail: inWebPreview ? "Live CPU needs Android" : "Native CPU sample pending" },
    ram: { value: inWebPreview ? "Android APK" : "Unavailable", detail: inWebPreview ? "Live RAM needs Android" : "Native RAM sample pending" },
    notice: inWebPreview
      ? "Preview mode has no Android foreground supervisor. Install the APK on the host phone to see live CPU and RAM."
      : "The native supervisor has not returned a sample. Start the installed Android app, then wait up to 12 seconds.",
  };
}
