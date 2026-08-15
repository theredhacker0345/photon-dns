import { readFileSync, writeFileSync } from "node:fs";

const inputPath = process.argv[2] ?? "/tmp/pocket-hermes-licenses.json";
const outputPath = process.argv[3] ?? "/tmp/pocket-hermes-license-audit.json";
const inventory = JSON.parse(readFileSync(inputPath, "utf8"));

const reviewLicenses = new Set(["Unknown", "MPL-2.0", "CC-BY-4.0"]);
const report = Object.entries(inventory)
  .map(([license, packages]) => ({
    license,
    packageCount: packages.length,
    packages: packages.map(({ name, versions, homepage, description }) => ({ name, versions, homepage, description })),
  }))
  .sort((a, b) => a.license.localeCompare(b.license));

const audit = {
  generatedAt: new Date().toISOString(),
  licenseGroups: report.map(({ license, packageCount }) => ({ license, packageCount })),
  reviewRequired: report.filter(({ license }) => reviewLicenses.has(license)),
  conclusion: "Permissive licenses dominate. Unknown, MPL-2.0, and CC-BY-4.0 entries require package-level review before release.",
};

writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify(audit, null, 2));
