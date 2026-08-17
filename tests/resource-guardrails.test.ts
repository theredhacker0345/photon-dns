import { defaultHostRuntimePolicy } from "../lib/host-contracts";
import { getRecommendedResourceLimits, getResourceLimitWarnings } from "../lib/resource-guardrails";
import type { SupervisorTelemetry } from "../lib/supervisor-telemetry";
import { describe, expect, it } from "vitest";

const mib = 1024 * 1024;
const gib = 1024 * mib;

const telemetry: SupervisorTelemetry = {
  agentStatus: "running",
  cpuPercent: 56,
  cpuCoreCount: 4,
  ramUsedBytes: 480 * mib,
  ramTotalBytes: 4 * gib,
  storageFreeBytes: 8 * gib,
  workspaceUsedBytes: 460 * mib,
  sampledAt: "2026-08-17T00:00:00.000Z",
  source: "native",
};

describe("resource guardrail presentation", () => {
  it("only warns when private process or workspace usage reaches the conservative 80% threshold", () => {
    const warnings = getResourceLimitWarnings({ telemetry, policy: defaultHostRuntimePolicy });
    expect(warnings.map((warning) => warning.resource)).toEqual(["cpu", "ram", "workspace"]);
    expect(warnings.find((warning) => warning.resource === "cpu")?.severity).toBe("warning");
    expect(warnings.find((warning) => warning.resource === "ram")?.severity).toBe("warning");
  });

  it("does not invent workspace pressure when Android has not supplied a private-workspace reading", () => {
    const warnings = getResourceLimitWarnings({ telemetry: { ...telemetry, workspaceUsedBytes: undefined }, policy: defaultHostRuntimePolicy });
    expect(warnings.some((warning) => warning.resource === "workspace")).toBe(false);
  });

  it("derives bounded conservative recommendations from Android-reported cores, RAM, and free app storage", () => {
    const recommendation = getRecommendedResourceLimits({ telemetry, policy: defaultHostRuntimePolicy });
    expect(recommendation).toMatchObject({ maximumCpuPercent: 50, maximumProcessRamBytes: 512 * mib, maximumWorkspaceBytes: 896 * mib });
    expect(recommendation?.deviceSummary).toContain("4 CPU cores");
  });

  it("requires Android capacity data rather than offering a fabricated browser recommendation", () => {
    expect(getRecommendedResourceLimits({ telemetry: { ...telemetry, cpuCoreCount: undefined }, policy: defaultHostRuntimePolicy })).toBeNull();
  });
});
