import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const expectedVersion = "3.0.23";
const packagePath = resolve("node_modules/expo-modules-autolinking/package.json");
const implementationPath = resolve(
  "node_modules/expo-modules-autolinking/scripts/android/autolinking_implementation.gradle",
);
const corePluginPath = resolve(
  "node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle",
);
const resolverPath = resolve(
  "node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js",
);
const startAnchor = "      // Add extra maven repositories to allprojects\n";
const endAnchor = "    // Apply plugins for all app projects\n";
const beforeProjectClosure = "    }\n\n";
const mavenLocalPublication =
  "      repositories {\n" +
  "        maven {\n" +
  "          url = mavenLocal().url\n" +
  "        }\n" +
  "      }\n";

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

const dynamicRepository = 'url "${mavenRepo.url}"';
const replacement =
  "      // Pocket Relay has no resolved extra Android Maven repositories.\n" +
  "      // Keep this static for F-Droid source scanning.\n" +
  beforeProjectClosure;
const implementation = readFileSync(implementationPath, "utf8");
const dynamicRepositoryCount = implementation.split(dynamicRepository).length - 1;
if (dynamicRepositoryCount === 0) {
  if (
    implementation.split(replacement).length - 1 !== 1 ||
    implementation.includes(startAnchor)
  ) {
    fail("autolinking implementation is neither the expected source nor the prepared form");
  }
} else if (dynamicRepositoryCount === 1) {
  const start = implementation.indexOf(startAnchor);
  const end = implementation.indexOf(endAnchor);
  if (start === -1 || end === -1 || end <= start) {
    fail("expected unused extraMavenRepos block was not found exactly once");
  }
  if (implementation.indexOf(startAnchor, start + startAnchor.length) !== -1) {
    fail("expected a single extraMavenRepos block");
  }
  const block = implementation.slice(start, end);
  if (
    block.split(dynamicRepository).length - 1 !== 1 ||
    !block.endsWith(beforeProjectClosure)
  ) {
    fail("expected one dynamic Maven URL and the settings-phase beforeProject closure");
  }
  writeFileSync(
    implementationPath,
    implementation.slice(0, start) + replacement + implementation.slice(end),
    "utf8",
  );
} else {
  fail("expected one dynamic Maven URL inside the removable block");
}

const corePlugin = readFileSync(corePluginPath, "utf8");
const corePreparedMarker =
  "      // Pocket Relay does not publish Maven artifacts during F-Droid builds.\n";
const mavenLocalPublicationCount =
  corePlugin.split(mavenLocalPublication).length - 1;
if (mavenLocalPublicationCount === 0) {
  if (
    corePlugin.split(corePreparedMarker).length - 1 !== 1 ||
    corePlugin.includes("mavenLocal().url")
  ) {
    fail("Expo Modules Core helper is neither the expected source nor the prepared form");
  }
} else if (mavenLocalPublicationCount === 1) {
  const preparedCorePlugin = corePlugin.replace(
    mavenLocalPublication,
    corePreparedMarker,
  );
  if (preparedCorePlugin.includes("mavenLocal().url")) {
    fail("Expo Modules Core mavenLocal repository remained after preparation");
  }
  writeFileSync(corePluginPath, preparedCorePlugin, "utf8");
} else {
  fail("expected one Expo Modules Core mavenLocal publication repository");
}

console.log(
  "Prepared Expo Modules Gradle helpers for F-Droid: no dynamic Maven repositories remain.",
);
