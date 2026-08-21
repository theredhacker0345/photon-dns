import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("open-source runtime and backup attribution", () => {
  it("credits Hermes Agent and Neuron Encrypt visibly in Settings", () => {
    const settings = read("app/(tabs)/settings.tsx");

    expect(settings).toContain('title="Runtime & backup credits"');
    expect(settings).toContain("Hermes Agent 0.20.1");
    expect(settings).toContain("Nous Research");
    expect(settings).toContain("Neuron Encrypt");
    expect(settings).toContain("Encrypted backup cryptography · GPL-3.0-only");
  });

  it("retains matching repository notices and source links", () => {
    const readme = read("README.md");
    const notices = read("THIRD_PARTY_NOTICES.md");

    expect(readme).toContain("Hermes Agent");
    expect(readme).toContain("Neuron Encrypt");
    expect(notices).toContain("Pinned, vendored embedded agent runtime");
    expect(notices).toContain("Native authenticated-encryption boundary");
  });
});
