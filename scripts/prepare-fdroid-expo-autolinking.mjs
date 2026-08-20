import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const expectedVersion = "3.0.23";
const packagePath = resolve("node_modules/expo-modules-autolinking/package.json");
const implementationPath = resolve(
  "node_modules/expo-modules-autolinking/scripts/android/autolinking_implementation.gradle",
);
const resolverPath = resolve(
  "node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js",
);
const startAnchor = "      // Add extra maven repositories to allprojects\n";
const endAnchor = "    // Apply plugins for all app projects\n";

function fail(message) {
  throw new Error(`F-Droid Expo autolinking preparation failed: ${message}`);
}

const packageMetadata = JSON.parse(readFileSync(packagePath, "utf8"));
if (packageMetadata.version !== expectedVersion) {
  fail(
    `expected expo-modules-autolinking ${expectedVersion}, received ${packageMetadata.version ?? "unknown"}`,
  );
}

const resolver = spawnSync(
  process.execPath,
  [resolverPath, "resolve", "--platform", "android", "--json"],
  { cwd: process.cwd(), encoding: "utf8" },
);
if (resolver.status !== 0) {
  fail(`Android resolver exited ${resolver.status}: ${resolver.stderr.trim()}`);
}

let resolvedModules;
try {
  resolvedModules = JSON.parse(resolver.stdout);
} catch (error) {
  fail(`Android resolver emitted invalid JSON: ${error.message}`);
}
if (
  !Array.isArray(resolvedModules.extraDependencies) ||
  resolvedModules.extraDependencies.length !== 0
) {
  fail("the locked dependency graph requires extra Android Maven repositories");
}

const implementation = readFileSync(implementationPath, "utf8");
const start = implementation.indexOf(startAnchor);
const end = implementation.indexOf(endAnchor);
if (start === -1 || end === -1 || end <= start) {
  fail("expected unused extraMavenRepos block was not found exactly once");
}
if (implementation.indexOf(startAnchor, start + startAnchor.length) !== -1) {
  fail("expected a single extraMavenRepos block");
}

const dynamicRepository = 'url "${mavenRepo.url}"';
const block = implementation.slice(start, end);
if (
  block.split(dynamicRepository).length - 1 !== 1 ||
  implementation.split(dynamicRepository).length - 1 !== 1
) {
  fail("expected one dynamic Maven URL inside the removable block");
}

const replacement =
  "      // Pocket Relay has no resolved extra Android Maven repositories.\n" +
  "      // Keep this static for F-Droid source scanning.\n";
writeFileSync(
  implementationPath,
  implementation.slice(0, start) + replacement + implementation.slice(end),
  "utf8",
);

console.log(
  "Prepared Expo Modules Autolinking 3.0.23 for F-Droid: no extra Android Maven repositories resolved.",
);
