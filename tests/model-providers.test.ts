import { describe, expect, it, vi } from "vitest";

import { filterModelCatalog } from "../lib/model-catalog-filters";
import { buildProviderHeaders, fetchProviderModels, getModelListUrl, getProviderPreset, normalizeOpenAiCompatibleModels } from "../lib/model-providers";

const fetchedAt = "2026-08-17T00:00:00.000Z";
const models = [
  { id: "vision-pro", displayName: "vision-pro", provider: "openrouter" as const, ownedBy: "acme", contextWindow: 128000, capabilities: ["text", "vision"], fetchedAt },
  { id: "tool-runner", displayName: "tool-runner", provider: "openrouter" as const, ownedBy: "acme", contextWindow: 16000, capabilities: ["text", "tools"], fetchedAt },
  { id: "small-chat", displayName: "small-chat", provider: "openrouter" as const, ownedBy: "other", contextWindow: 8000, capabilities: ["text"], fetchedAt },
];

describe("provider model discovery", () => {
  it("exposes neutral provider presets with HTTPS endpoints", () => {
    expect(getProviderPreset("openai").defaultEndpoint).toBe("https://api.openai.com/v1");
    expect(getProviderPreset("openrouter").defaultEndpoint).toBe("https://openrouter.ai/api/v1");
    expect(getProviderPreset("custom").defaultEndpoint).toBe("");
  });

  it("builds a stable models endpoint without duplicate slashes", () => {
    expect(getModelListUrl("https://api.example/v1")).toBe("https://api.example/v1/models");
    expect(getModelListUrl("https://api.example/v1/")).toBe("https://api.example/v1/models");
    expect(getModelListUrl("https://api.example/v1/models")).toBe("https://api.example/v1/models");
  });

  it("uses bearer authentication without embedding tokens in catalog records", () => {
    expect(buildProviderHeaders("secret-token")).toEqual({ Accept: "application/json", Authorization: "Bearer secret-token" });
  });

  it("normalizes compatible provider models and ignores malformed records", () => {
    const result = normalizeOpenAiCompatibleModels({ data: [
      { id: "model-a", owned_by: "provider-a", context_length: 128000, capabilities: ["text", "vision"] },
      { id: "model-b", ownedBy: "provider-b" },
      { owned_by: "missing-id" },
      null,
    ] }, "openrouter", fetchedAt);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "model-a", provider: "openrouter", ownedBy: "provider-a", contextWindow: 128000 });
    expect(result[0]).not.toHaveProperty("token");
    expect(result[1]).toMatchObject({ id: "model-b", provider: "openrouter" });
  });

  it("fails closed for a non-compatible payload", () => {
    expect(normalizeOpenAiCompatibleModels({ models: [{ name: "not-openai-shape" }] }, "custom", "now")).toEqual([]);
  });

  it("reports authenticated status and measured latency on a successful catalog check", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [{ id: "model-a" }] }) })));
    const result = await fetchProviderModels({ provider: "openai", endpoint: "https://api.openai.com/v1", apiKey: "secret-token" });
    expect(result.ok).toBe(true);
    expect(result.connection.authStatus).toBe("authenticated");
    expect(result.connection.latencyMs).toEqual(expect.any(Number));
    expect(result.connection.checkedAt).toEqual(expect.any(String));
    vi.unstubAllGlobals();
  });

  it("reports unauthorized status without returning model records", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: "invalid" }) })));
    const result = await fetchProviderModels({ provider: "openai", endpoint: "https://api.openai.com/v1", apiKey: "bad-token" });
    expect(result.ok).toBe(false);
    expect(result.models).toEqual([]);
    expect(result.connection.authStatus).toBe("unauthorized");
    expect(result.connection.latencyMs).toEqual(expect.any(Number));
    vi.unstubAllGlobals();
  });

  it("searches model IDs and owners and applies capability/context filters", () => {
    expect(filterModelCatalog(models, "VISION", "all").map((model) => model.id)).toEqual(["vision-pro"]);
    expect(filterModelCatalog(models, "", "tools").map((model) => model.id)).toEqual(["tool-runner"]);
    expect(filterModelCatalog(models, "", "long-context").map((model) => model.id)).toEqual(["vision-pro"]);
    expect(filterModelCatalog(models, "other", "all").map((model) => model.id)).toEqual(["small-chat"]);
  });
});
