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
const reactNativeModuleRepositoryTransforms = [
  {
    path: resolve(
      "node_modules/@react-native-async-storage/async-storage/android/build.gradle",
    ),
    source:
      "    maven {\n" +
      "        // All of React Native (JS, Obj-C sources, Android binaries) is installed from npm\n" +
      '        url "${project.ext.resolveModulePath("react-native")}/android"\n' +
      "    }\n",
    marker:
      "    // Pocket Relay resolves React Android from Maven Central during F-Droid builds.\n",
    required: "implementation 'com.facebook.react:react-native:+'",
  },
  {
    path: resolve(
      "node_modules/react-native-safe-area-context/android/build.gradle",
    ),
    source:
      "    maven {\n" +
      "        // All of React Native (JS, Obj-C sources, Android binaries) is installed from npm\n" +
      '        url "$rootDir/../node_modules/react-native/android"\n' +
      "    }\n",
    marker:
      "    // Pocket Relay resolves React Android from Maven Central during F-Droid builds.\n",
    required: "implementation 'com.facebook.react:react-native:+'",
  },
  {
    path: resolve("node_modules/react-native-screens/android/build.gradle"),
    source:
      "repositories {\n" +
      "    maven {\n" +
      '        url "${reactNativeRootDir}/android"\n' +
      "    }\n\n" +
      "    mavenCentral()\n" +
      "    mavenLocal()\n" +
      "    google()\n" +
      "}\n",
    marker:
      "repositories {\n" +
      "    // Pocket Relay resolves React Android from Maven Central during F-Droid builds.\n" +
      "    mavenCentral()\n" +
      "    google()\n" +
      "}\n",
    required: "implementation 'com.facebook.react:react-native:+'",
  },
];
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
const sourceBuiltExpoPackages = [
  "expo-asset",
  "expo-battery",
  "expo-crypto",
  "expo-document-picker",
  "expo-file-system",
  "expo-font",
  "expo-haptics",
  "expo-keep-awake",
  "expo-linking",
  "expo-secure-store",
  "expo-sharing",
  "expo-splash-screen",
  "expo-system-ui",
];

function fail(message) {
  throw new Error(`F-Droid Expo autolinking preparation failed: ${message}`);
}

function replaceExactlyOnceOrVerifyPrepared({ path, source, marker, required }) {
  const content = readFileSync(path, "utf8");
  const sourceCount = content.split(source).length - 1;
  if (sourceCount === 0) {
    if (content.split(marker).length - 1 !== 1) {
      fail(`${path} is neither the expected source nor the prepared form`);
    }
  } else if (sourceCount === 1) {
    writeFileSync(path, content.replace(source, marker), "utf8");
  } else {
    fail(`expected one removable React Native repository block in ${path}`);
  }

  const prepared = readFileSync(path, "utf8");
  if (prepared.includes(source) || !prepared.includes(required)) {
    fail(`React Native Gradle structure changed unexpectedly in ${path}`);
  }
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
const localPublicationExpoPackages = (resolvedModules.modules ?? [])
  .filter((module) =>
    module.projects?.some(
      (project) => project.publication?.repository === "local-maven-repo",
    ),
  )
  .map((module) => module.packageName)
  .sort();
const configuredSourcePackages = [...(resolvedModules.configuration?.buildFromSource ?? [])].sort();
const expectedSourcePackages = [...sourceBuiltExpoPackages].sort();
if (JSON.stringify(configuredSourcePackages) !== JSON.stringify(expectedSourcePackages)) {
  fail(
    `Expo Android build-from-source configuration drifted: ${configuredSourcePackages.join(", ")}`,
  );
}
if (JSON.stringify(localPublicationExpoPackages) !== JSON.stringify(expectedSourcePackages)) {
  fail(
    `Expo Android local Maven publication set changed: ${localPublicationExpoPackages.join(", ")}`,
  );
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

for (const transform of reactNativeModuleRepositoryTransforms) {
  replaceExactlyOnceOrVerifyPrepared(transform);
}

console.log(
  "Prepared Expo and React Native Gradle helpers for F-Droid: every local publication is source-built or replaced by Maven Central, with no dynamic Maven repositories remaining.",
);
