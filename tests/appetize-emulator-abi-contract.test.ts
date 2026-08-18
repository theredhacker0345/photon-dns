import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Appetize emulator ABI compatibility", () => {
  it("keeps ARM64 as the default while allowing a deliberate x86_64 test override", () => {
    const appGradle = read("android/app/build.gradle");
    const supervisorGradle = read("modules/pocket-hermes-supervisor/android/build.gradle");
    const plugin = read("plugins/with-arm64-only.js");

    for (const source of [appGradle, supervisorGradle, plugin]) {
      expect(source).toContain('System.getenv("POCKET_HERMES_ANDROID_ABIS") ?: "arm64-v8a"');
      expect(source).toContain("abiFilters(*");
    }
  });

  it("uses a separate embedded-Python lock only for the explicit x86_64 emulator profile", () => {
    const supervisorGradle = read("modules/pocket-hermes-supervisor/android/build.gradle");
    const requirements = read("modules/pocket-hermes-supervisor/android/src/main/python/requirements-android-x86_64.txt");

    expect(supervisorGradle).toContain('POCKET_HERMES_EMULATOR_TEST_BUILD") == "true"');
    expect(supervisorGradle).toContain("requirements-android-x86_64.txt");
    expect(requirements).toContain("pydantic_core-2.46.4-cp311-cp311-android_24_x86_64.whl");
  });
});
