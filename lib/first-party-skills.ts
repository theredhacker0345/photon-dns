import type { SkillPackage } from "@/lib/skill-contracts";

export type FirstPartySkill = {
  id: string;
  category: string;
  skillPackage: SkillPackage;
};

/**
 * Built with Pocket Relay and reviewed as source code. These packages deliberately
 * use the same zero-permission, isolated QuickJS contract as every imported skill.
 */
export const FIRST_PARTY_SKILLS: FirstPartySkill[] = [
  {
    id: "normalize-text",
    category: "Text",
    skillPackage: {
      manifest: {
        format: "pocket-relay-skill/v1",
        name: "Normalize text",
        version: "1.0.0",
        description: "Trims text and collapses repeated whitespace into single spaces.",
        author: "Pocket Relay Contributors",
        license: "GPL-3.0-or-later",
        type: "quickjs",
        entrypoint: "main.js",
        permissions: [],
        inputSchema: { type: "object", required: ["text"], additionalProperties: false, properties: { text: { type: "string", description: "Text to normalize." } } },
        outputSchema: { type: "object", required: ["text"], additionalProperties: false, properties: { text: { type: "string" } } },
        sourceSha256: "c0bcfbd050bcb7ae6050e4011cab457aefc2245d37e03eb66753cf85529cff28",
      },
      source: `function run(input) {
  return { text: input.text.trim().replace(/\s+/g, " ") };
}`,
    },
  },
  {
    id: "text-statistics",
    category: "Text",
    skillPackage: {
      manifest: {
        format: "pocket-relay-skill/v1",
        name: "Text statistics",
        version: "1.0.0",
        description: "Counts characters, words, and lines in a supplied text value.",
        author: "Pocket Relay Contributors",
        license: "GPL-3.0-or-later",
        type: "quickjs",
        entrypoint: "main.js",
        permissions: [],
        inputSchema: { type: "object", required: ["text"], additionalProperties: false, properties: { text: { type: "string", description: "Text to inspect." } } },
        outputSchema: { type: "object", required: ["characters", "words", "lines"], additionalProperties: false, properties: { characters: { type: "integer" }, words: { type: "integer" }, lines: { type: "integer" } } },
        sourceSha256: "d709702e4b0aa60a976bcb7c40087438d158d7af928a2805e90c8d6a08d15b4d",
      },
      source: `function run(input) {
  const text = input.text.trim();
  return {
    characters: text.length,
    words: text ? text.split(/\s+/).length : 0,
    lines: text ? text.split(/\r?\n/).length : 0,
  };
}`,
    },
  },
  {
    id: "json-inspector",
    category: "Data",
    skillPackage: {
      manifest: {
        format: "pocket-relay-skill/v1",
        name: "JSON inspector",
        version: "1.0.0",
        description: "Checks whether text is valid JSON and reports the top-level JSON type.",
        author: "Pocket Relay Contributors",
        license: "GPL-3.0-or-later",
        type: "quickjs",
        entrypoint: "main.js",
        permissions: [],
        inputSchema: { type: "object", required: ["text"], additionalProperties: false, properties: { text: { type: "string", description: "JSON text to inspect." } } },
        outputSchema: { type: "object", required: ["valid", "type"], additionalProperties: false, properties: { valid: { type: "boolean" }, type: { type: "string" } } },
        sourceSha256: "43d9c76cc7b922045c034465605bc301a9a2fd7f0d52df1d1df099f95483cf1a",
      },
      source: `function run(input) {
  const value = JSON.parse(input.text);
  return { valid: true, type: Array.isArray(value) ? "array" : value === null ? "null" : typeof value };
}`,
    },
  },
];

export function getFirstPartySkill(id: string) {
  return FIRST_PARTY_SKILLS.find((skill) => skill.id === id) ?? null;
}
