import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

import { FIRST_PARTY_SKILLS } from "../lib/first-party-skills";
import { normalizeSkillManifest, parseSkillInput, validateJsonAgainstSchema } from "../lib/skill-contracts";
import type { SkillManifest } from "../lib/skill-contracts";

const manifest: SkillManifest = {
  format: "pocket-relay-skill/v1", name: "word-counter", version: "1.0.0", description: "Counts words in one string without host access.", author: "Pocket Relay community", license: "GPL-3.0-or-later", type: "quickjs", entrypoint: "main.js", permissions: [], sourceSha256: "a".repeat(64),
  inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false },
  outputSchema: { type: "object", properties: { count: { type: "integer" } }, required: ["count"], additionalProperties: false },
};

describe("Pocket Relay skills contract", () => {
  it("accepts only capability-free QuickJS manifests with a FOSS license and source hash", () => {
    const result = normalizeSkillManifest(manifest);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.permissions).toEqual([]);
    expect(normalizeSkillManifest({ ...manifest, permissions: ["network"] }).ok).toBe(false);
    expect(normalizeSkillManifest({ ...manifest, type: "python" }).ok).toBe(false);
    expect(normalizeSkillManifest({ ...manifest, license: "Proprietary" }).ok).toBe(false);
  });

  it("blocks malformed, oversized, and schema-incompatible owner input before native execution", () => {
    expect(parseSkillInput("{\"text\":\"hello relay\"}", manifest.inputSchema).ok).toBe(true);
    expect(parseSkillInput("{\"text\":2}", manifest.inputSchema).ok).toBe(false);
    expect(parseSkillInput("not-json", manifest.inputSchema).ok).toBe(false);
    expect(parseSkillInput(`{\"text\":\"${"x".repeat(9000)}\"}`, manifest.inputSchema).ok).toBe(false);
  });

  it("validates a skill result against its reviewed output schema", () => {
    expect(validateJsonAgainstSchema({ count: 2 }, manifest.outputSchema)).toBeNull();
    expect(validateJsonAgainstSchema({ count: 2.5 }, manifest.outputSchema)).toContain("integer");
    expect(validateJsonAgainstSchema({ count: 2, extra: true }, manifest.outputSchema)).toContain("Unexpected field");
  });

  it("ships only small capability-free first-party samples whose manifests bind to their exact source", () => {
    expect(FIRST_PARTY_SKILLS).toHaveLength(3);
    for (const sample of FIRST_PARTY_SKILLS) {
      expect(sample.id).toMatch(/^[a-z0-9-]+$/);
      expect(normalizeSkillManifest(sample.skillPackage.manifest).ok).toBe(true);
      expect(sample.skillPackage.manifest.permissions).toEqual([]);
      expect(sample.skillPackage.source).toContain("function run(input)");
      expect(createHash("sha256").update(sample.skillPackage.source, "utf8").digest("hex")).toBe(sample.skillPackage.manifest.sourceSha256);
    }
  });
});
