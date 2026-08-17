import { describe, expect, it } from "vitest";

import {
  canStartWorker,
  defaultHostRuntimePolicy,
  getRuntimePolicyBlock,
  isAllowedModelEndpoint,
  isSafeRuntimePolicy,
  isTerminalTaskStatus,
} from "../lib/host-contracts";

describe("Pocket Agent Host cross-layer host contract", () => {
  it("requires a credential-free HTTPS endpoint", () => {
    expect(isAllowedModelEndpoint("https://model.example/v1")).toBe(true);
    expect(isAllowedModelEndpoint("http://model.example/v1")).toBe(false);
    expect(isAllowedModelEndpoint("https://key@model.example/v1")).toBe(false);
    expect(isAllowedModelEndpoint("not-a-url")).toBe(false);
  });

  it("rejects unsafe runtime policy thresholds", () => {
    expect(isSafeRuntimePolicy(defaultHostRuntimePolicy)).toBe(true);
    expect(isSafeRuntimePolicy({ ...defaultHostRuntimePolicy, lowBatteryPercent: 0 })).toBe(false);
    expect(isSafeRuntimePolicy({ ...defaultHostRuntimePolicy, minimumFreeStorageBytes: 0 })).toBe(false);
  });

  it("does not permit a worker start until Telegram, model, and policy requirements are all satisfied", () => {
    const base = {
      hostName: "Pocket Agent Host",
      ownerChatId: "123456",
      telegramConfigured: true,
      model: { endpoint: "https://model.example/v1", model: "small-host-model", hasApiKey: true },
      policy: defaultHostRuntimePolicy,
    };
    expect(canStartWorker(base)).toBe(true);
    expect(canStartWorker({ ...base, model: { ...base.model, hasApiKey: false } })).toBe(false);
    expect(canStartWorker({ ...base, ownerChatId: "" })).toBe(false);
  });

  it("blocks native starts that violate the saved charging or storage policy while leaving preview unblocked", () => {
    expect(getRuntimePolicyBlock(defaultHostRuntimePolicy, { source: "native", isCharging: false, freeStorageBytes: 4 * 1024 * 1024 * 1024 })).toContain("charging");
    expect(getRuntimePolicyBlock(defaultHostRuntimePolicy, { source: "native", isCharging: true, freeStorageBytes: 1 })).toContain("storage");
    expect(getRuntimePolicyBlock(defaultHostRuntimePolicy, { source: "preview", isCharging: null, freeStorageBytes: null })).toBeNull();
  });

  it("treats only final task results as terminal", () => {
    expect(isTerminalTaskStatus("queued")).toBe(false);
    expect(isTerminalTaskStatus("running")).toBe(false);
    expect(isTerminalTaskStatus("completed")).toBe(true);
    expect(isTerminalTaskStatus("delivery_failed")).toBe(true);
  });
});
