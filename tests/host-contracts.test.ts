import { describe, expect, it } from "vitest";

import {
  canStartWorker,
  defaultHostRuntimePolicy,
  getRuntimePolicyBlock,
  isAllowedModelEndpoint,
  isSafeRuntimePolicy,
  isSafeTelegramProxyConfiguration,
  isTerminalTaskStatus,
  type PublicHostConfiguration,
} from "../lib/host-contracts";

describe("Pocket Relay cross-layer host contract", () => {
  it("requires a credential-free HTTPS endpoint", () => {
    expect(isAllowedModelEndpoint("https://model.example/v1")).toBe(true);
    expect(isAllowedModelEndpoint("http://model.example/v1")).toBe(false);
    expect(isAllowedModelEndpoint("https://key@model.example/v1")).toBe(false);
    expect(isAllowedModelEndpoint("not-a-url")).toBe(false);
  });

  it("allows HTTP only for explicit local providers at numeric private-LAN addresses", () => {
    expect(isAllowedModelEndpoint("http://192.168.1.20:11434/v1", "ollama")).toBe(true);
    expect(isAllowedModelEndpoint("http://10.0.0.8:1234/v1", "lmstudio")).toBe(true);
    expect(isAllowedModelEndpoint("http://localhost:11434/v1", "ollama")).toBe(false);
    expect(isAllowedModelEndpoint("http://model.lan/v1", "ollama")).toBe(false);
    expect(isAllowedModelEndpoint("http://192.168.1.20/v1", "openai")).toBe(false);
  });

  it("accepts only explicit credential-free Telegram proxy metadata", () => {
    expect(isSafeTelegramProxyConfiguration({ type: "none", host: "", port: null, hasCredentials: false })).toBe(true);
    expect(isSafeTelegramProxyConfiguration({ type: "http", host: "proxy.example.net", port: 8080, hasCredentials: true })).toBe(true);
    expect(isSafeTelegramProxyConfiguration({ type: "socks5", host: "10.0.0.9", port: 1080, hasCredentials: false })).toBe(true);
    expect(isSafeTelegramProxyConfiguration({ type: "http", host: "https://proxy.example.net", port: 8080, hasCredentials: false })).toBe(false);
    expect(isSafeTelegramProxyConfiguration({ type: "socks5", host: "proxy.example.net/path", port: 1080, hasCredentials: false })).toBe(false);
    expect(isSafeTelegramProxyConfiguration({ type: "http", host: "proxy.example.net", port: 0, hasCredentials: false })).toBe(false);
    expect(isSafeTelegramProxyConfiguration({ type: "none", host: "proxy.example.net", port: 8080, hasCredentials: false })).toBe(false);
  });

  it("rejects unsafe runtime policy thresholds", () => {
    expect(isSafeRuntimePolicy(defaultHostRuntimePolicy)).toBe(true);
    expect(isSafeRuntimePolicy({ ...defaultHostRuntimePolicy, lowBatteryPercent: 0 })).toBe(false);
    expect(isSafeRuntimePolicy({ ...defaultHostRuntimePolicy, minimumFreeStorageBytes: 0 })).toBe(false);
  });

  it("does not permit a worker start until Telegram, model, and policy requirements are all satisfied", () => {
    const base: PublicHostConfiguration = {
      hostName: "Pocket Relay",
      ownerChatId: "123456",
      telegramConfigured: true,
      model: { provider: "openai", endpoint: "https://model.example/v1", model: "small-host-model", hasApiKey: true },
      policy: defaultHostRuntimePolicy,
    };
    expect(canStartWorker(base)).toBe(true);
    expect(canStartWorker({ ...base, model: { ...base.model, hasApiKey: false } })).toBe(false);
    expect(canStartWorker({ ...base, model: { provider: "ollama", endpoint: "http://192.168.1.20:11434/v1", model: "llama3.2", hasApiKey: false } })).toBe(true);
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
