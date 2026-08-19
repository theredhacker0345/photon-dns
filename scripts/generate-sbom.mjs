#!/usr/bin/env node

/**
 * Generates a CycloneDX 1.6 SBOM for Python distributions in Chaquopy's
 * release payload, excluding its build environment and debug payload. It
 * rejects absent license evidence and license labels outside the project’s
 * approved FOSS family.
 *
 * Usage:
 *   node scripts/generate-sbom.mjs
 *   node scripts/generate-sbom.mjs --site-packages-root path/to/site-packages
 */

import { createHash } from "node:crypto";
import { existsSync, promises as fs } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const moduleRoot = join(projectRoot, "modules", "pocket-hermes-supervisor", "android");
const requirementsPath = join(moduleRoot, "src", "main", "python", "requirements-android.txt");
const outputPath = join(projectRoot, "sbom.json");
const hermesVendorRoot = join(projectRoot, "third_party", "hermes-agent");
const hermesProvenancePath = join(hermesVendorRoot, "UPSTREAM.md");
const sourceDateEpoch = Number.parseInt(process.env.SOURCE_DATE_EPOCH ?? "1786807638", 10);
const approvedLicense = /\b(MIT|Apache(?: Software License)?(?:[- ]2(?:\.0)?)?|BSD(?:[- ](?:2|3)[- ]Clause)?|ISC|PSF|Python Software Foundation|MPL(?:[- ]2(?:\.0)?)?|LGPL(?:[- ]\S+)?|GNU Lesser General Public License|GPL(?:[- ]\S+)?|EPL(?:[- ]\S+)?|Zlib|Unlicense|CC0|Freetype|IJG|Independent JPEG Group)\b/i;
const ignoredDirectories = new Set(["__pycache__", ".git", ".pytest_cache"]);
const chaquopyRuntimeLicenses = new Map([
  ["chaquopy-freetype", { evidence: "Freetype License (FTL)", reference: "https://freetype.org/license.html" }],
  ["chaquopy-libffi", { evidence: "MIT License", reference: "https://github.com/libffi/libffi/blob/master/LICENSE" }],
  ["chaquopy-libjpeg", { evidence: "Independent JPEG Group (IJG) license", reference: "https://www.ijg.org/files/" }],
  ["chaquopy-libyaml", { evidence: "MIT License", reference: "https://github.com/yaml/libyaml/blob/master/LICENSE" }],
]);

function normalizeName(name) {
  return name.trim().toLowerCase().replace(/[-_.]+/g, "-");
}

function parseMetadata(text) {
  const fields = new Map();
  let current = "";
  for (const line of text.split(/\r?\n/)) {
    if (/^[ \t]/.test(line) && current) {
      fields.set(current, `${fields.get(current)} ${line.trim()}`);
      continue;
    }
    const match = /^([^:]+):\s*(.*)$/.exec(line);
    if (match) {
      current = match[1];
      const values = fields.get(current) ?? [];
      fields.set(current, Array.isArray(values) ? [...values, match[2]] : [values, match[2]]);
    }
  }
  const getAll = (field) => {
    const value = fields.get(field) ?? [];
    return Array.isArray(value) ? value.flatMap((item) => Array.isArray(item) ? item : [item]) : [value];
  };
  return {
    name: String(getAll("Name")[0] ?? ""),
    version: String(getAll("Version")[0] ?? ""),
    licenses: [
      ...getAll("License"),
      ...getAll("License-Expression"),
      ...getAll("Classifier").filter((item) => item.includes("License ::")),
    ],
  };
}

async function findMetadataDirectories(directory) {
  const matches = [];
  if (!existsSync(directory)) return matches;
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (!entry.isDirectory() || ignoredDirectories.has(entry.name)) continue;
    if (entry.name.endsWith(".dist-info") && existsSync(join(entryPath, "METADATA"))) {
      matches.push(entryPath);
      continue;
    }
    matches.push(...await findMetadataDirectories(entryPath));
  }
  return matches;
}

async function hashDirectory(directory) {
  const files = [];
  async function visit(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      if (ignoredDirectories.has(entry.name)) continue;
      const entryPath = join(current, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (entry.isFile()) files.push(entryPath);
    }
  }
  await visit(directory);
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    hash.update(relative(directory, file));
    hash.update(await fs.readFile(file));
  }
  return hash.digest("hex");
}

async function vendoredHermesDigest() {
  const files = [];
  async function visit(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      if (entry.name === "UPSTREAM.md") continue;
      const entryPath = join(current, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (entry.isFile()) files.push(entryPath);
    }
  }
  await visit(hermesVendorRoot);
  const listing = [];
  for (const file of files.sort((a, b) => {
    const left = relative(hermesVendorRoot, a).replaceAll("\\", "/");
    const right = relative(hermesVendorRoot, b).replaceAll("\\", "/");
    return left < right ? -1 : left > right ? 1 : 0;
  })) {
    const digest = createHash("sha256").update(await fs.readFile(file)).digest("hex");
    listing.push(`${relative(hermesVendorRoot, file)}  ${digest}`);
  }
  return createHash("sha256").update(listing.join("\n") + "\n").digest("hex");
}

async function hermesSourceLicense(name, version) {
  if (normalizeName(name) !== "hermes-agent") throw new Error("No PyPI metadata available for this package.");
  const provenance = await fs.readFile(hermesProvenancePath, "utf8");
  const revision = provenance.match(/Upstream revision \| `([0-9a-f]{40})`/)?.[1];
  const expectedDigest = provenance.match(/Stable content digest \| `([0-9a-f]{64})`/)?.[1];
  const license = await fs.readFile(join(hermesVendorRoot, "LICENSE"), "utf8");
  if (revision !== "165c889e5b4277b56dadd42949a4112c1e6175a6" || !expectedDigest || await vendoredHermesDigest() !== expectedDigest) {
    throw new Error("Vendored Hermes provenance or source digest does not match the pinned reviewed snapshot.");
  }
  if (!license.includes("MIT License")) throw new Error("Vendored Hermes source did not preserve MIT license evidence.");
  const reference = "https://github.com/NousResearch/hermes-agent/blob/165c889e5b4277b56dadd42949a4112c1e6175a6/LICENSE";
  return { evidence: "MIT License (pinned upstream source)", reference: `pkg:github/NousResearch/hermes-agent@${version}`, externalReference: reference };
}

function localDistributionLicense(name, version, metadata) {
  return {
    evidence: metadata.licenses.filter(Boolean).join("; "),
    reference: `pkg:pypi/${normalizeName(name)}@${version}`,
  };
}

function deterministicUuid(hash) {
  const variant = ((Number.parseInt(hash[16], 16) & 0x3) | 0x8).toString(16);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-${variant}${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function requestedVersion(requirements, packageName, fallbackVersion) {
  const expression = new RegExp(`^${packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\[[^\]]+\\])?==([^\\s;#]+)`, "im");
  const match = expression.exec(requirements);
  return match?.[1] ?? fallbackVersion;
}

async function main() {
  const args = process.argv.slice(2);
  const rootIndex = args.indexOf("--site-packages-root");
  const explicitRoot = rootIndex >= 0 ? resolve(args[rootIndex + 1] ?? "") : null;
  if (rootIndex >= 0 && !explicitRoot) throw new Error("--site-packages-root requires a directory.");
  const requirements = await fs.readFile(requirementsPath, "utf8");
  const metadataDirs = explicitRoot
    ? await findMetadataDirectories(explicitRoot)
    : await findMetadataDirectories(join(moduleRoot, "build", "python", "pip", "release"));
  if (metadataDirs.length === 0) {
    throw new Error("No Chaquopy site-packages metadata found. Build the Android module before generating a release SBOM.");
  }

  const packages = [];
  const failures = [];
  for (const metadataDir of metadataDirs) {
    const metadata = parseMetadata(await fs.readFile(join(metadataDir, "METADATA"), "utf8"));
    if (!metadata.name || !metadata.version) continue;
    const name = normalizeName(metadata.name);
    const version = requestedVersion(requirements, metadata.name, metadata.version);
    try {
      const registry = chaquopyRuntimeLicenses.get(name)
        ? { ...chaquopyRuntimeLicenses.get(name), reference: `pkg:generic/${name}@${version}`, externalReference: chaquopyRuntimeLicenses.get(name).reference }
        : name === "hermes-agent"
          ? await hermesSourceLicense(name, version)
          : localDistributionLicense(name, version, metadata);
      const evidence = [registry.evidence, ...metadata.licenses].filter(Boolean).join("; ");
      if (!approvedLicense.test(evidence)) {
        throw new Error(`non-FOSS or unrecognized license evidence: ${evidence || "none"}`);
      }
      packages.push({
        type: "library",
        name: metadata.name,
        version,
        purl: registry.reference,
        licenses: [{ license: { name: registry.evidence || "FOSS license documented in wheel metadata" } }],
        hashes: [{ alg: "SHA-256", content: await hashDirectory(metadataDir) }],
        externalReferences: registry.externalReference ? [{ type: "license", url: registry.externalReference }] : undefined,
        properties: [{ name: "pocket-hermes.license-evidence", value: evidence }],
      });
    } catch (error) {
      failures.push(`${metadata.name} ${version}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failures.length) {
    throw new Error(`FOSS release gate failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  }
  const uniquePackages = [...new Map(packages.map((item) => [`${item.name}@${item.version}`, item])).values()]
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!Number.isSafeInteger(sourceDateEpoch) || sourceDateEpoch < 315532800) {
    throw new Error("SOURCE_DATE_EPOCH must be a valid Unix timestamp on or after 1980-01-01.");
  }
  const bomHash = createHash("sha256").update(JSON.stringify(uniquePackages)).digest("hex");
  const bom = {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: `urn:uuid:${deterministicUuid(bomHash)}`,
    version: 1,
    metadata: {
      timestamp: new Date(sourceDateEpoch * 1000).toISOString(),
      tools: { components: [{ type: "application", name: "Pocket Relay SBOM generator", version: "1.0.0" }] },
      component: { type: "application", name: "Pocket Relay embedded Hermes worker", version: "0.20.1", licenses: [{ license: { id: "MIT" } }] },
    },
    components: uniquePackages,
  };
  await fs.writeFile(outputPath, `${JSON.stringify(bom, null, 2)}\n`);
  console.log(`Wrote ${uniquePackages.length}-component CycloneDX SBOM to ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
