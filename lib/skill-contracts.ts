type ExpoCryptoModule = typeof import("expo-crypto");

/** A deliberately small JSON-schema subset that can be enforced in both TypeScript and the isolated Android executor. */
export type PocketJsonSchema = {
  type: "object" | "array" | "string" | "number" | "integer" | "boolean" | "null";
  title?: string;
  description?: string;
  enum?: Array<string | number | boolean | null>;
  properties?: Record<string, PocketJsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: PocketJsonSchema;
};

export type SkillManifest = {
  format: "pocket-relay-skill/v1";
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  type: "quickjs";
  entrypoint: "main.js";
  permissions: [];
  inputSchema: PocketJsonSchema;
  outputSchema: PocketJsonSchema;
  sourceSha256: string;
};

export type SkillProvenance = {
  kind: "github" | "ai" | "first_party";
  originalUrl?: string;
  repository?: string;
  commitSha?: string;
  manifestUrl?: string;
  sourceUrl?: string;
  request?: string;
  catalogId?: string;
};

export type SkillDraft = {
  id: string;
  manifest: SkillManifest;
  provenance: SkillProvenance;
  createdAt: string;
};

export type InstalledSkill = {
  id: string;
  manifest: SkillManifest;
  provenance: SkillProvenance;
  installedAt: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: "ok" | "error" | "timeout" | "rejected" | null;
};

export type SkillPackage = { manifest: SkillManifest; source: string };
/** Portable, credential-free format used only for exporting a reviewed package to an owner-selected share target. */
export type PortableSkillExport = { format: "pocket-relay-skill-export/v1"; manifest: SkillManifest; source: string };
export type SkillValidation<T> = { ok: true; value: T } | { ok: false; message: string };

export const MAX_INSTALLED_SKILLS = 20;
export const MAX_SKILL_DRAFTS = 8;
/** Leaves Binder headroom for one bounded 8 KiB JSON input alongside the sealed source. */
export const MAX_SKILL_SOURCE_BYTES = 20 * 1024;
export const MAX_SKILL_INPUT_BYTES = 8 * 1024;
export const MAX_SKILL_MANIFEST_BYTES = 8 * 1024;
export const MAX_SKILL_NAME_LENGTH = 48;
export const SKILL_FOSS_LICENSES = new Set([
  "0BSD", "Apache-2.0", "Artistic-2.0", "BSD-2-Clause", "BSD-3-Clause", "CC0-1.0", "EPL-2.0", "GPL-2.0-only", "GPL-2.0-or-later", "GPL-3.0-only", "GPL-3.0-or-later", "ISC", "LGPL-2.1-only", "LGPL-2.1-or-later", "LGPL-3.0-only", "LGPL-3.0-or-later", "MIT", "MPL-2.0", "Unlicense",
]);

const IDENTIFIER_PATTERN = /^[a-z][a-z0-9-]{2,63}$/;
const SHA_256_PATTERN = /^[a-f0-9]{64}$/;
const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,31}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function utf8Bytes(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function normalizeText(value: unknown, field: string, minimum: number, maximum: number): SkillValidation<string> {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < minimum || text.length > maximum) return { ok: false, message: `${field} must contain ${minimum}–${maximum} characters.` };
  return { ok: true, value: text };
}

function normalizeScalar(value: unknown): string | number | boolean | null | undefined {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return undefined;
}

function normalizeSchema(value: unknown, depth = 0): SkillValidation<PocketJsonSchema> {
  if (!isRecord(value) || depth > 4) return { ok: false, message: "Skill schemas must use the supported JSON-schema subset and stay within five levels." };
  const type = value.type;
  if (type !== "object" && type !== "array" && type !== "string" && type !== "number" && type !== "integer" && type !== "boolean" && type !== "null") {
    return { ok: false, message: "Each skill schema requires a supported JSON type." };
  }
  const schema: PocketJsonSchema = { type };
  const title = typeof value.title === "string" ? value.title.trim().slice(0, 80) : "";
  const description = typeof value.description === "string" ? value.description.trim().slice(0, 240) : "";
  if (title) schema.title = title;
  if (description) schema.description = description;
  if (value.enum !== undefined) {
    if (!Array.isArray(value.enum) || value.enum.length === 0 || value.enum.length > 12) return { ok: false, message: "Schema enums must contain 1–12 JSON scalar values." };
    const enumValues = value.enum.map(normalizeScalar);
    if (enumValues.some((item) => item === undefined)) return { ok: false, message: "Schema enums may contain only JSON scalar values." };
    schema.enum = enumValues as Array<string | number | boolean | null>;
  }
  if (type === "object") {
    const rawProperties = value.properties ?? {};
    if (!isRecord(rawProperties) || Object.keys(rawProperties).length > 24) return { ok: false, message: "Object schemas may define up to 24 properties." };
    const properties: Record<string, PocketJsonSchema> = {};
    for (const [key, child] of Object.entries(rawProperties)) {
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(key)) return { ok: false, message: "Schema property names must use safe identifier characters." };
      const nested = normalizeSchema(child, depth + 1);
      if (!nested.ok) return nested;
      properties[key] = nested.value;
    }
    schema.properties = properties;
    const required = value.required === undefined ? [] : value.required;
    if (!Array.isArray(required) || required.some((item) => typeof item !== "string" || !Object.hasOwn(properties, item))) {
      return { ok: false, message: "Schema required fields must reference declared properties." };
    }
    schema.required = [...new Set(required)];
    schema.additionalProperties = value.additionalProperties === true;
  }
  if (type === "array") {
    const items = normalizeSchema(value.items, depth + 1);
    if (!items.ok) return { ok: false, message: "Array schemas require one supported item schema." };
    schema.items = items.value;
  }
  return { ok: true, value: schema };
}

export function isSafeSkillIdentifier(value: string) {
  return IDENTIFIER_PATTERN.test(value);
}

export function normalizeSkillManifest(value: unknown): SkillValidation<SkillManifest> {
  if (!isRecord(value)) return { ok: false, message: "A skill manifest must be a JSON object." };
  if (value.format !== "pocket-relay-skill/v1") return { ok: false, message: "This skill does not declare the supported pocket-relay-skill/v1 format." };
  const name = normalizeText(value.name, "Name", 3, MAX_SKILL_NAME_LENGTH);
  const description = normalizeText(value.description, "Description", 8, 280);
  const author = normalizeText(value.author, "Author", 2, 80);
  const license = normalizeText(value.license, "License", 3, 80);
  if (!name.ok) return { ok: false, message: name.message };
  if (!description.ok) return { ok: false, message: description.message };
  if (!author.ok) return { ok: false, message: author.message };
  if (!license.ok) return { ok: false, message: license.message };
  const version = typeof value.version === "string" ? value.version.trim() : "";
  if (!VERSION_PATTERN.test(version)) return { ok: false, message: "Version must use a compact semantic-version-like identifier." };
  if (!SKILL_FOSS_LICENSES.has(license.value)) return { ok: false, message: "Use a recognized FOSS SPDX license identifier for this skill." };
  if (value.type !== "quickjs") return { ok: false, message: "Pocket Relay accepts QuickJS-only skills. Python, shell, and native code packages are blocked." };
  if (value.entrypoint !== "main.js") return { ok: false, message: "Skills must use the fixed main.js entrypoint." };
  if (!Array.isArray(value.permissions) || value.permissions.length !== 0) return { ok: false, message: "QuickJS skills must explicitly declare an empty permissions list." };
  const sourceSha256 = typeof value.sourceSha256 === "string" ? value.sourceSha256.trim().toLowerCase() : "";
  if (!SHA_256_PATTERN.test(sourceSha256)) return { ok: false, message: "Skill manifests must include the lowercase SHA-256 hash of main.js." };
  const inputSchema = normalizeSchema(value.inputSchema);
  const outputSchema = normalizeSchema(value.outputSchema);
  if (!inputSchema.ok) return { ok: false, message: inputSchema.message };
  if (!outputSchema.ok) return { ok: false, message: outputSchema.message };
  const manifest = {
    format: "pocket-relay-skill/v1" as const,
    name: name.value,
    version,
    description: description.value,
    author: author.value,
    license: license.value,
    type: "quickjs" as const,
    entrypoint: "main.js" as const,
    permissions: [] as [],
    inputSchema: inputSchema.value,
    outputSchema: outputSchema.value,
    sourceSha256,
  };
  if (utf8Bytes(JSON.stringify(manifest)) > MAX_SKILL_MANIFEST_BYTES) return { ok: false, message: "Skill manifest exceeds the 8 KiB safety limit." };
  return { ok: true, value: manifest };
}

export function validateQuickJsSkillSource(source: unknown): SkillValidation<string> {
  const value = typeof source === "string" ? source.replace(/\r\n/g, "\n").trim() : "";
  if (!value) return { ok: false, message: "Skill source cannot be empty." };
  if (utf8Bytes(value) > MAX_SKILL_SOURCE_BYTES) return { ok: false, message: "Skill source exceeds the 24 KiB isolated-executor limit." };
  if (!/(?:function\s+run\s*\(|(?:const|let|var)\s+run\s*=)/.test(value)) return { ok: false, message: "QuickJS skill source must define a synchronous run(input) function." };
  if (/\b(?:import|require|eval|Function)\b/.test(value)) return { ok: false, message: "Skill source may not use modules or dynamic code evaluation." };
  return { ok: true, value };
}

export async function hashSkillSource(source: string) {
  const Crypto = await import("expo-crypto") as ExpoCryptoModule;
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, source, { encoding: Crypto.CryptoEncoding.HEX });
}

export async function validateSkillPackage(value: { manifest: unknown; source: unknown }): Promise<SkillValidation<SkillPackage>> {
  const manifest = normalizeSkillManifest(value.manifest);
  const source = validateQuickJsSkillSource(value.source);
  if (!manifest.ok) return { ok: false, message: manifest.message };
  if (!source.ok) return { ok: false, message: source.message };
  const actualHash = await hashSkillSource(source.value);
  if (actualHash !== manifest.value.sourceSha256) return { ok: false, message: "The main.js SHA-256 hash does not match the reviewed skill manifest." };
  return { ok: true, value: { manifest: manifest.value, source: source.value } };
}

export async function validatePortableSkillExport(value: unknown): Promise<SkillValidation<SkillPackage>> {
  if (!isRecord(value) || value.format !== "pocket-relay-skill-export/v1") {
    return { ok: false, message: "This file does not declare the supported pocket-relay-skill-export/v1 format." };
  }
  return validateSkillPackage({ manifest: value.manifest, source: value.source });
}

export function validateJsonAgainstSchema(value: unknown, schema: PocketJsonSchema, depth = 0): string | null {
  if (depth > 5) return "Input exceeds the supported schema depth.";
  if (schema.enum && !schema.enum.some((item) => Object.is(item, value))) return "Input is not one of the allowed values.";
  if (schema.type === "null") return value === null ? null : "Expected null.";
  if (schema.type === "boolean") return typeof value === "boolean" ? null : "Expected a boolean.";
  if (schema.type === "string") return typeof value === "string" ? null : "Expected a string.";
  if (schema.type === "number") return typeof value === "number" && Number.isFinite(value) ? null : "Expected a finite number.";
  if (schema.type === "integer") return typeof value === "number" && Number.isInteger(value) ? null : "Expected an integer.";
  if (schema.type === "array") {
    if (!Array.isArray(value)) return "Expected an array.";
    if (!schema.items) return "The skill array schema is incomplete.";
    for (const item of value) {
      const result = validateJsonAgainstSchema(item, schema.items, depth + 1);
      if (result) return result;
    }
    return null;
  }
  if (!isRecord(value)) return "Expected an object.";
  const properties = schema.properties ?? {};
  for (const property of schema.required ?? []) if (!(property in value)) return `Missing required field: ${property}.`;
  for (const [key, item] of Object.entries(value)) {
    const child = properties[key];
    if (!child && !schema.additionalProperties) return `Unexpected field: ${key}.`;
    if (child) {
      const result = validateJsonAgainstSchema(item, child, depth + 1);
      if (result) return `${key}: ${result}`;
    }
  }
  return null;
}

export function parseSkillInput(inputJson: string, schema: PocketJsonSchema): SkillValidation<unknown> {
  if (utf8Bytes(inputJson) > MAX_SKILL_INPUT_BYTES) return { ok: false, message: "Skill input exceeds the 8 KiB isolated-executor limit." };
  try {
    const value = JSON.parse(inputJson) as unknown;
    const validation = validateJsonAgainstSchema(value, schema);
    return validation ? { ok: false, message: validation } : { ok: true, value };
  } catch {
    return { ok: false, message: "Skill input must be valid JSON." };
  }
}
