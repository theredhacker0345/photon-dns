import { describe, expect, it } from "vitest";

import {
  getSupervisorTelemetryPresentation,
  normalizeSupervisorTelemetry,
  type SupervisorTelemetry,
} from "../lib/supervisor-telemetry";

const gib = 1024 * 1024 * 1024;

const liveTelemetry: SupervisorTelemetry = {
  agentStatus: "running",
  cpuPercent: 37,
  ramUsedBytes: Math.round(1.5 * gib),
  ramTotalBytes: 4 * gib,
  sampledAt: "2026-08-17T00:00:00.000Z",
  source: "native",
};

describe("Home telemetry contract", () => {
  it("refuses malformed Android readings rather than rendering invented CPU or RAM", () => {
    expect(normalizeSupervisorTelemetry({ ...liveTelemetry, cpuPercent: -1 })).toBeNull();
    expect(normalizeSupervisorTelemetry({ ...liveTelemetry, ramTotalBytes: 0 })).toBeNull();
    expect(normalizeSupervisorTelemetry({ ...liveTelemetry, ramUsedBytes: 5 * gib })).toBeNull();
  });

  it("makes the web preview explicitly require the Android APK instead of pretending live metrics exist", () => {
    const presentation = getSupervisorTelemetryPresentation({ telemetry: null, status: "bridge-required", platform: "web" });
    expect(presentation.statusLabel).toBe("Preview mode");
    expect(presentation.cpu.value).toBe("Android APK");
    expect(presentation.ram.value).toBe("Android APK");
    expect(presentation.notice).toContain("Install the APK");
  });

  it("shows a sampling state for the first Android CPU baseline while preserving the real RAM reading", () => {
    const presentation = getSupervisorTelemetryPresentation({ telemetry: liveTelemetry, status: "sampling", platform: "android" });
    expect(presentation.cpu.value).toBe("Sampling…");
    expect(presentation.ram.value).toBe("1.5 GB");
    expect(presentation.notice).toContain("within 12 seconds");
  });

  it("renders formatted live CPU and RAM only after the Android supervisor has supplied a sample", () => {
    const presentation = getSupervisorTelemetryPresentation({ telemetry: liveTelemetry, status: "live", platform: "android" });
    expect(presentation.statusLabel).toBe("Live supervisor");
    expect(presentation.cpu.value).toBe("37%");
    expect(presentation.ram.value).toBe("1.5 GB");
    expect(presentation.ram.detail).toBe("of 4.0 GB");
    expect(presentation.notice).toBeNull();
  });
});
