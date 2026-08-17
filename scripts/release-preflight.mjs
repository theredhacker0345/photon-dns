#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "app.config.ts",
  "android/app/build.gradle",
  "plugins/with-release-signing.js",
  "metadata/com.app.pockethermes.yml",
  "docs/reproducible-release-policy.md",
  "sbom.json",
  "sbom-js.json",
  "license-audit.json",
];

const fail = (message) => {
  console.error(`Release preflight failed: ${message}`);
  process.exitCode = 1;
};

for (const relativePath of requiredFiles) {
  if (!existsSync(join(root, relativePath))) fail(`missing required evidence file: ${relativePath}`);
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (packageJson.name !== "pocket-hermes") fail("package name must be pocket-hermes");
if (packageJson.scripts?.dev !== "pnpm dev:metro") fail("development server must be Metro-only");
if ("dev:server" in (packageJson.scripts ?? {})) fail("removed backend server script is still present");

const appConfig = readFileSync(join(root, "app.config.ts"), "utf8");
if (!appConfig.includes('const rawBundleId = "com.app.pockethermes"')) fail("Android package identifier is not pinned");
if (!appConfig.includes('"./plugins/with-release-signing"')) fail("optional release-signing plugin is missing");

const gradle = readFileSync(join(root, "android/app/build.gradle"), "utf8");
if (!gradle.includes("assembling an unsigned release artifact for F-Droid signing")) {
  fail("unsigned F-Droid release path is missing");
}
const buildTypesStart = gradle.indexOf("buildTypes {");
const releaseStart = gradle.indexOf("release {", buildTypesStart);
const releaseBlock = gradle.slice(releaseStart, gradle.indexOf("proguardFiles", releaseStart));
if (releaseBlock.includes("signingConfig signingConfigs.debug")) {
  fail("release build must never fall back to the debug signing key");
}

const audit = JSON.parse(readFileSync(join(root, "license-audit.json"), "utf8"));
if (audit.counts?.["manual-review"] !== 0 || audit.counts?.blocked !== 0) {
  fail("license audit contains unresolved or blocked components");
}

const tagIndex = process.argv.indexOf("--tag");
if (tagIndex >= 0) {
  const tag = process.argv[tagIndex + 1];
  if (!tag) {
    fail("--tag requires an immutable Git tag name");
  } else {
    try {
      execFileSync("git", ["rev-parse", "--verify", `${tag}^{commit}`], { cwd: root, stdio: "pipe" });
      console.log(`Verified local immutable release reference: ${tag}`);
    } catch {
      fail(`Git tag ${tag} does not resolve to a commit`);
    }
  }
}

if (!process.exitCode) {
  console.log("Local Pocket Hermes release preflight passed.");
  if (tagIndex < 0) {
    console.log("For a publication handoff, run this command again with --tag <immutable-public-release-tag>.");
  }
}
