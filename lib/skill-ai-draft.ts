import { type SkillPackage, type SkillProvenance, hashSkillSource, validateSkillPackage } from "@/lib/skill-contracts";

type DraftPayload = { manifest: Record<string, unknown>; source: string };

function extractJsonObject(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced ?? value.trim();
  return JSON.parse(candidate) as unknown;
}

/** Produces a constrained prompt that asks the configured Hermes runtime for code only, never an install or execution action. */
export function buildSkillDraftPrompt(request: string) {
  const cleanRequest = request.trim().slice(0, 600);
  return [
    "Create a Pocket Relay skill draft for the owner request below. This is a draft only: do not execute it, claim it is installed, request credentials, access a network, or use a terminal.",
    `Owner request: ${cleanRequest}`,
    "Return exactly one JSON object with keys manifest and source, with no Markdown or explanation.",
    "manifest must include: format='pocket-relay-skill/v1', name (3-48 chars), version, description, author, license (a FOSS SPDX identifier), type='quickjs', entrypoint='main.js', permissions=[], inputSchema, outputSchema. Omit sourceSha256; Pocket Relay calculates it after review.",
    "source must define one synchronous JavaScript function named run(input). It receives JSON and returns JSON-serializable data. Do not use import, require, eval, Function, network APIs, filesystem APIs, timers, or Android APIs. Keep source under 24 KiB.",
    "Use only the JSON-schema subset: type object|array|string|number|integer|boolean|null; object properties, required, additionalProperties; array items; optional enum/title/description.",
  ].join("\n\n");
}

/** Parses an assistant reply then seals the manifest with a locally calculated source hash before the owner can stage it. */
export async function parseAiSkillDraftResponse(response: string, request: string): Promise<{ ok: true; value: { skillPackage: SkillPackage; provenance: SkillProvenance } } | { ok: false; message: string }> {
  try {
    const parsed = extractJsonObject(response);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, message: "Hermes did not return a skill draft object." };
    const payload = parsed as Record<string, unknown>;
    const manifestCandidate = payload.manifest;
    const source = payload.source;
    if (!manifestCandidate || typeof manifestCandidate !== "object" || Array.isArray(manifestCandidate) || typeof source !== "string") {
      return { ok: false, message: "The assistant reply must contain manifest and source fields." };
    }
    const sourceSha256 = await hashSkillSource(source.replace(/\r\n/g, "\n").trim());
    const validation = await validateSkillPackage({ manifest: { ...(manifestCandidate as Record<string, unknown>), sourceSha256 }, source });
    if (!validation.ok) return { ok: false, message: validation.message };
    return { ok: true, value: { skillPackage: validation.value, provenance: { kind: "ai", request: request.trim().slice(0, 600) } } };
  } catch {
    return { ok: false, message: "The assistant reply was not a valid Pocket Relay skill draft JSON object." };
  }
}
