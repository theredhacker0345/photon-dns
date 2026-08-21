import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const settings = readFileSync(resolve(process.cwd(), "app/(tabs)/settings.tsx"), "utf8");

describe("private-LAN provider entry points", () => {
  it("makes Ollama and LM Studio explicit one-tap options in Settings", () => {
    expect(settings).toContain('label="Add Ollama"');
    expect(settings).toContain('label="Add LM Studio"');
    expect(settings).toContain('beginNewProvider("ollama")');
    expect(settings).toContain('beginNewProvider("lmstudio")');
  });

  it("uses the selected local preset instead of reverting local-provider shortcuts to OpenAI", () => {
    expect(settings).toContain('const beginNewProvider = (provider: ModelProviderId = "openai")');
    expect(settings).toContain("selectProvider(provider);");
    expect(settings).toContain("numeric private-network address");
  });
});
