import { describe, expect, it } from "vitest";

import { defaultHostRuntimePolicy, isSafeRuntimePolicy } from "../lib/host-contracts";
import { canPreparePrivateHost, isValidTelegramChatId, normalizeHostName, validationMessage } from "../lib/pocket-hermes-policy";

describe("Pocket Agent Host host policy", () => {
  it("accepts a private owner Telegram user ID and rejects group identifiers", () => {
    expect(isValidTelegramChatId("123456789")).toBe(true);
    expect(isValidTelegramChatId("-1001234567890")).toBe(false);
  });

  it("rejects empty and non-numeric Telegram identifiers", () => {
    expect(isValidTelegramChatId("")).toBe(false);
    expect(isValidTelegramChatId("user-name")).toBe(false);
    expect(isValidTelegramChatId("12 34")).toBe(false);
  });

  it("requires both a protected token and a valid owner chat before preparing the host", () => {
    expect(canPreparePrivateHost({ hasTelegramToken: true, allowedChatId: "42" })).toBe(true);
    expect(canPreparePrivateHost({ hasTelegramToken: false, allowedChatId: "42" })).toBe(false);
    expect(canPreparePrivateHost({ hasTelegramToken: true, allowedChatId: "owner" })).toBe(false);
  });

  it("returns actionable configuration feedback and a safe host-name default", () => {
    expect(validationMessage({ hasTelegramToken: true, allowedChatId: "owner" })).toContain("Telegram user ID");
    expect(validationMessage({ hasTelegramToken: false, allowedChatId: "42" })).toContain("bot token");
    expect(normalizeHostName("   ")).toBe("Pocket Agent Host");
    expect(normalizeHostName(" Old Phone ")).toBe("Old Phone");
  });

  it("accepts only bounded resource guardrails and ordered visual alert thresholds", () => {
    expect(isSafeRuntimePolicy(defaultHostRuntimePolicy)).toBe(true);
    expect(isSafeRuntimePolicy({ ...defaultHostRuntimePolicy, maximumCpuPercent: 9 })).toBe(false);
    expect(isSafeRuntimePolicy({ ...defaultHostRuntimePolicy, maximumProcessRamBytes: 127 * 1024 * 1024 })).toBe(false);
    expect(isSafeRuntimePolicy({ ...defaultHostRuntimePolicy, maximumWorkspaceBytes: 63 * 1024 * 1024 })).toBe(false);
    expect(isSafeRuntimePolicy({ ...defaultHostRuntimePolicy, warningThresholdPercent: 49 })).toBe(false);
    expect(isSafeRuntimePolicy({ ...defaultHostRuntimePolicy, criticalThresholdPercent: 80 })).toBe(false);
  });
});
