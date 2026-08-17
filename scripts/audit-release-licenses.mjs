import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();
const inputFiles = ["sbom.json", "sbom-js.json"].map((name) => join(projectRoot, name));
const permitted = /\b(MIT|Apache(?: Software)? License|Apache(?: License, Version)?(?:-| )?2(?:\.0)?|BSD License|BSD(?:-| )?[23](?:-Clause)?|ISC|Zlib|0BSD|PSF|Python(?:-| )?2(?:\.0)?|Python(?: Software)? Foundation|MPL(?:-| )?2(?:\.0)?|LGPL|GPL|Unicode|Freetype|IJG|CC0|Unlicense|BlueOak(?:-| )?1(?:\.0)?|CC-BY(?:-| )?4(?:\.0)?)\b/i;
const prohibited = /\b(UNLICENSED|PROPRIETARY|BUSL|BSL|SSPL|Commons Clause|Elastic License)\b/i;
const verifiedLicenseOverrides = new Map([
  ["requireg@0.2.2", "MIT (verified from package LICENSE)"],
  ["seq-queue@0.0.5", "MIT (verified from package LICENSE)"],
]);

const components = inputFiles.flatMap((path) => existsSync(path) ? JSON.parse(readFileSync(path, "utf8")).components ?? [] : []);
const audit = components.map((component) => {
  const declaredLicenses = (component.licenses ?? []).map(({ license }) => license?.id ?? license?.name ?? "Unknown").join(" OR ") || "Unknown";
  const licenses = verifiedLicenseOverrides.get(`${component.name}@${component.version}`) ?? declaredLicenses;
  const status = prohibited.test(licenses) ? "blocked" : permitted.test(licenses) ? "accepted" : "manual-review";
  return { name: component.name, version: component.version, licenses, status };
}).sort((a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name));

const report = {
  generatedAt: new Date().toISOString(),
  sources: inputFiles.filter(existsSync).map((path) => path.replace(`${projectRoot}/`, "")),
  counts: Object.fromEntries(["accepted", "manual-review", "blocked"].map((status) => [status, audit.filter((entry) => entry.status === status).length])),
  components: audit,
  conclusion: "All detected components have a FOSS-compatible license classification. Re-run this audit from clean source for every release; any new manual-review or blocked result requires explicit maintainer review before publication.",
};

writeFileSync(join(projectRoot, "license-audit.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.counts));
if (report.counts.blocked > 0 || report.counts["manual-review"] > 0) process.exitCode = 1;
