import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";

const projectRoot = process.cwd();
const rootPackagePath = join(projectRoot, "package.json");
const rootPackage = JSON.parse(readFileSync(rootPackagePath, "utf8"));
const visited = new Map();
const unresolved = [];

function packageJsonFor(name, fromFile) {
  const requireFrom = createRequire(fromFile);
  try {
    return requireFrom.resolve(`${name}/package.json`);
  } catch {
    const installedRootMetadata = join(projectRoot, "node_modules", ...name.split("/"), "package.json");
    if (existsSync(installedRootMetadata)) return installedRootMetadata;
    try {
      const entry = requireFrom.resolve(name);
      let cursor = dirname(entry);
      while (cursor.startsWith(projectRoot) && cursor !== dirname(cursor)) {
        const candidate = join(cursor, "package.json");
        if (existsSync(candidate)) {
          const candidatePackage = JSON.parse(readFileSync(candidate, "utf8"));
          if (candidatePackage.name === name) return candidate;
        }
        cursor = dirname(cursor);
      }
    } catch {
      return null;
    }
  }
  return null;
}

function normalizedLicense(pkg) {
  if (typeof pkg.license === "string" && pkg.license.trim()) return pkg.license.trim();
  if (Array.isArray(pkg.licenses) && pkg.licenses.length > 0) {
    return pkg.licenses.map((license) => typeof license === "string" ? license : license?.type).filter(Boolean).join(" OR ");
  }
  return "Unknown";
}

function visit(name, fromFile, ancestry = [], optional = false) {
  const packagePath = packageJsonFor(name, fromFile) ?? packageJsonFor(name, rootPackagePath);
  if (!packagePath) {
    if (!optional) unresolved.push({ name, requestedBy: basename(fromFile), ancestry });
    return;
  }
  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  const identity = `${pkg.name}@${pkg.version}`;
  if (visited.has(identity)) return;

  const packageDirectory = dirname(packagePath);
  const dependencies = { ...(pkg.dependencies ?? {}), ...(pkg.optionalDependencies ?? {}) };
  visited.set(identity, {
    type: "library",
    name: pkg.name,
    version: pkg.version,
    purl: `pkg:npm/${encodeURIComponent(pkg.name)}@${pkg.version}`,
    licenses: [{ license: { name: normalizedLicense(pkg) } }],
    hashes: [{ alg: "SHA-256", content: createHash("sha256").update(readFileSync(packagePath)).digest("hex") }],
    properties: [
      { name: "pocket-hermes.dependency-scope", value: "production-js" },
      { name: "pocket-hermes.package-json", value: resolve(packagePath).replace(projectRoot, ".") },
    ],
  });
  for (const dependency of Object.keys(dependencies).sort()) {
    const isOptional = dependency in (pkg.optionalDependencies ?? {}) && !(dependency in (pkg.dependencies ?? {}));
    visit(dependency, packagePath, [...ancestry, identity], isOptional);
  }
  void packageDirectory;
}

for (const dependency of Object.keys(rootPackage.dependencies ?? {}).sort()) visit(dependency, rootPackagePath);

const bom = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: {
      type: "application",
      name: "Pocket Hermes mobile JavaScript runtime",
      version: rootPackage.version,
      licenses: [{ license: { id: "MIT" } }],
    },
  },
  components: [...visited.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version)),
  properties: [{ name: "pocket-hermes.unresolved-production-dependencies", value: JSON.stringify(unresolved) }],
};

writeFileSync(join(projectRoot, "sbom-js.json"), `${JSON.stringify(bom, null, 2)}\n`);
console.log(`Wrote sbom-js.json with ${bom.components.length} production JavaScript components and ${unresolved.length} unresolved edges.`);
if (unresolved.length > 0) process.exitCode = 2;
