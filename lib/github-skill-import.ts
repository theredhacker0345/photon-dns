import { type SkillPackage, type SkillProvenance, validatePortableSkillExport, validateSkillPackage } from "@/lib/skill-contracts";

const GITHUB_OWNER_REPO = /^[A-Za-z0-9_.-]{1,80}$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_REMOTE_FILE_BYTES = 32 * 1024;

type GitHubCoordinates = { owner: string; repository: string; ref: string | null; originalUrl: string; path: string; portableBundle: boolean };
export type GitHubSkillImport = { skillPackage: SkillPackage; provenance: SkillProvenance };

function safeGitHubPart(value: string) {
  return GITHUB_OWNER_REPO.test(value) ? value : null;
}

function normalizeSkillPath(parts: string[]) {
  const path = parts.join("/");
  if (!path || path.length > 300 || parts.some((part) => !part || part === "." || part === "..")) return null;
  return path;
}

function isPortableBundlePath(path: string) {
  return path.endsWith(".pocket-relay-skill.json");
}

function parseGithubCoordinates(value: string): { ok: true; value: GitHubCoordinates } | { ok: false; message: string } {
  let url: URL;
  try { url = new URL(value.trim()); } catch { return { ok: false, message: "Enter a complete HTTPS GitHub repository or immutable skill.json link." }; }
  if (url.protocol !== "https:") return { ok: false, message: "Skills may be imported only from HTTPS GitHub links." };
  const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (url.hostname === "github.com") {
    const [owner, repository, mode, ref, ...rest] = segments;
    if (!owner || !repository || !safeGitHubPart(owner) || !safeGitHubPart(repository)) return { ok: false, message: "Use a GitHub owner/repository link." };
    if (!mode) return { ok: true, value: { owner, repository, ref: null, originalUrl: url.toString(), path: "", portableBundle: false } };
    const path = rest.length ? normalizeSkillPath(rest) : "";
    if (mode === "tree" && (rest.length === 0 || path)) {
      if (!ref) return { ok: false, message: "The GitHub link is missing its branch, tag, or commit reference." };
      return { ok: true, value: { owner, repository, ref, originalUrl: url.toString(), path: path ?? "", portableBundle: Boolean(path && isPortableBundlePath(path)) } };
    }
    if (mode === "blob" && path && (path === "skill.json" || isPortableBundlePath(path))) {
      if (!ref) return { ok: false, message: "The GitHub link is missing its branch, tag, or commit reference." };
      return { ok: true, value: { owner, repository, ref, originalUrl: url.toString(), path, portableBundle: isPortableBundlePath(path) } };
    }
    return { ok: false, message: "Use a repository root, a /tree/<ref> folder, or a /blob/<ref>/skill.json or .pocket-relay-skill.json link." };
  }
  if (url.hostname === "raw.githubusercontent.com") {
    const [owner, repository, ref, ...rest] = segments;
    const path = normalizeSkillPath(rest);
    if (!owner || !repository || !ref || !safeGitHubPart(owner) || !safeGitHubPart(repository) || !path || (path !== "skill.json" && !isPortableBundlePath(path))) {
      return { ok: false, message: "Use a raw.githubusercontent.com owner/repository/<ref>/skill.json or .pocket-relay-skill.json URL." };
    }
    return { ok: true, value: { owner, repository, ref, originalUrl: url.toString(), path, portableBundle: isPortableBundlePath(path) } };
  }
  return { ok: false, message: "Only github.com and raw.githubusercontent.com skill links are allowed." };
}

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { Accept: "application/vnd.github+json" }, signal: controller.signal });
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}.`);
    return await response.json() as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveCommit(owner: string, repository: string, requestedRef: string | null) {
  let ref = requestedRef;
  if (!ref) {
    const repositoryResponse = await fetchJson(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`);
    ref = typeof (repositoryResponse as Record<string, unknown>).default_branch === "string" ? (repositoryResponse as Record<string, unknown>).default_branch as string : null;
  }
  if (!ref || ref.length > 120) throw new Error("GitHub did not provide a usable branch, tag, or commit reference.");
  const commitResponse = await fetchJson(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/commits/${encodeURIComponent(ref)}`);
  const commitRecord = commitResponse as Record<string, unknown>;
  const sha = typeof commitRecord.sha === "string" ? commitRecord.sha.toLowerCase() : "";
  if (!COMMIT_SHA.test(sha)) throw new Error("GitHub did not return an immutable 40-character commit SHA.");
  return sha;
}

async function fetchBoundedRaw(url: string, expectedUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { Accept: "text/plain" }, signal: controller.signal });
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}.`);
    if (response.url && response.url !== expectedUrl) throw new Error("GitHub redirected the immutable skill file to an unexpected location.");
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_REMOTE_FILE_BYTES) throw new Error("GitHub skill file exceeds the 32 KiB import limit.");
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_REMOTE_FILE_BYTES) throw new Error("GitHub skill file exceeds the 32 KiB import limit.");
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetches a GitHub skill only from one resolved commit, so manifest and source cannot drift between review and installation. */
export async function importSkillFromGitHub(value: string): Promise<{ ok: true; value: GitHubSkillImport } | { ok: false; message: string }> {
  const coordinates = parseGithubCoordinates(value);
  if (!coordinates.ok) return coordinates;
  try {
    const { owner, repository, originalUrl, path, portableBundle } = coordinates.value;
    const commitSha = await resolveCommit(owner, repository, coordinates.value.ref);
    const rawRoot = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/${commitSha}`;
    if (portableBundle) {
      const bundleUrl = `${rawRoot}/${path}`;
      const bundleText = await fetchBoundedRaw(bundleUrl, bundleUrl);
      let bundle: unknown;
      try { bundle = JSON.parse(bundleText); } catch { return { ok: false, message: "The portable skill bundle is not valid JSON." }; }
      const validation = await validatePortableSkillExport(bundle);
      if (!validation.ok) return validation;
      return { ok: true, value: { skillPackage: validation.value, provenance: { kind: "github", originalUrl, repository: `https://github.com/${owner}/${repository}`, commitSha, manifestUrl: bundleUrl, sourceUrl: bundleUrl } } };
    }
    const directory = path ? `/${path.replace(/\/$/, "")}` : "";
    const manifestUrl = `${rawRoot}${directory}/skill.json`;
    const manifestText = await fetchBoundedRaw(manifestUrl, manifestUrl);
    let manifest: unknown;
    try { manifest = JSON.parse(manifestText); } catch { return { ok: false, message: "skill.json is not valid JSON." }; }
    const sourceUrl = `${rawRoot}${directory}/main.js`;
    const source = await fetchBoundedRaw(sourceUrl, sourceUrl);
    const validation = await validateSkillPackage({ manifest, source });
    if (!validation.ok) return validation;
    return {
      ok: true,
      value: {
        skillPackage: validation.value,
        provenance: {
          kind: "github",
          originalUrl,
          repository: `https://github.com/${owner}/${repository}`,
          commitSha,
          manifestUrl,
          sourceUrl,
        },
      },
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? `GitHub import failed: ${error.message}` : "GitHub import could not be completed." };
  }
}
