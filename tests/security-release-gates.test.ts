import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("security and FOSS release gates", () => {
  it("documents actual data boundaries, owner controls, and explicit Android limitations", () => {
    const threatModel = read("docs/threat-model.md");
    const privacy = read("docs/privacy.md");
    expect(threatModel).toContain("single private numeric owner identity");
    expect(threatModel).toContain("not a general-purpose remote shell");
    expect(threatModel).toContain("guarantee that Android will keep a process alive");
    expect(privacy).toContain("does not include an app analytics SDK");
    expect(privacy).toContain("Configured HTTPS model endpoint");
    expect(privacy).toContain("native configuration deletion path");
  });

  it("keeps the JavaScript production SBOM and release license gate reproducible from source", () => {
    const generator = read("scripts/generate-js-sbom.mjs");
    const audit = read("scripts/audit-release-licenses.mjs");
    const packageJson = read("package.json");
    expect(generator).toContain('"production-js"');
    expect(generator).toContain("unresolved-production-dependencies");
    expect(audit).toContain('"manual-review"');
    expect(audit).toContain('"blocked"');
    expect(audit).toContain('report.counts["manual-review"] > 0');
    expect(read("docs/license-verification.md")).toContain("seq-queue@0.0.5");
    expect(packageJson).toContain('"sbom:js"');
    expect(packageJson).toContain('"audit:licenses"');
  });

  it("keeps a Metro-only app graph and an unsigned-by-default F-Droid release path", () => {
    const packageJson = read("package.json");
    const appConfig = read("app.config.ts");
    const gradle = read("android/app/build.gradle");
    const preflight = read("scripts/release-preflight.mjs");
    const policy = read("docs/reproducible-release-policy.md");
    const fdroidChecklist = read("docs/fdroid-submission-checklist.md");

    expect(packageJson).toContain('"dev": "pnpm dev:metro"');
    expect(packageJson).not.toContain('"dev:server"');
    expect(appConfig).toContain('const rawBundleId = "com.app.pockethermes"');
    expect(appConfig).toContain('"./plugins/with-release-signing"');
    expect(gradle).toContain("assembling an unsigned release artifact for F-Droid signing");
    const buildTypes = gradle.slice(gradle.indexOf("buildTypes {"));
    const releaseBlock = buildTypes.slice(buildTypes.indexOf("release {"), buildTypes.indexOf("proguardFiles"));
    expect(releaseBlock).not.toContain("signingConfig signingConfigs.debug");
    expect(preflight).toContain("Git tag");
    expect(preflight).toContain("manual-review");
    expect(policy).toContain("public HTTPS Git repository");
    expect(fdroidChecklist).toContain("immutable release tag");
  });
});
