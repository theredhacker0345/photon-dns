import { describe, expect, it } from "vitest";

import { buildProviderHeaders, getModelListUrl, getProviderPreset, normalizeOpenAiCompatibleModels } from "../lib/model-providers";

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
    ] }, "openrouter", "2026-08-17T00:00:00.000Z");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "model-a", provider: "openrouter", ownedBy: "provider-a", contextWindow: 128000 });
    expect(result[0]).not.toHaveProperty("token");
    expect(result[1]).toMatchObject({ id: "model-b", provider: "openrouter" });
  });

  it("fails closed for a non-compatible payload", () => {
    expect(normalizeOpenAiCompatibleModels({ models: [{ name: "not-openai-shape" }] }, "custom", "now")).toEqual([]);
  });
});
