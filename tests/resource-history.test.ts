import { defaultHostRuntimePolicy } from "../lib/host-contracts";
import { appendResourceHistory, getResourceHistorySample } from "../lib/resource-history";
import type { SupervisorTelemetry } from "../lib/supervisor-telemetry";
import { describe, expect, it } from "vitest";

const mib = 1024 * 1024;
const telemetry: SupervisorTelemetry = { agentStatus: "running", cpuPercent: 25, ramUsedBytes: 256 * mib, ramTotalBytes: 1024 * mib, workspaceUsedBytes: 128 * mib, sampledAt: "2026-08-17T00:00:00.000Z", source: "native" };

describe("resource history", () => {
  it("derives private resource percentages without inspecting phone-wide storage", () => {
    expect(getResourceHistorySample({ telemetry, policy: defaultHostRuntimePolicy })).toMatchObject({ cpuPercent: 25, ramPercent: 25, workspacePercent: 25 });
  });

  it("keeps history bounded and replaces duplicate native samples instead of accumulating them", () => {
    const first = getResourceHistorySample({ telemetry, policy: defaultHostRuntimePolicy });
    const replacement = { ...first, cpuPercent: 30 };
    expect(appendResourceHistory([first], replacement, 2)).toEqual([replacement]);
    const second = { ...replacement, sampledAt: "2026-08-17T00:00:12.000Z" };
    const third = { ...replacement, sampledAt: "2026-08-17T00:00:24.000Z" };
    expect(appendResourceHistory(appendResourceHistory([replacement], second, 2), third, 2)).toEqual([second, third]);
  });
});
