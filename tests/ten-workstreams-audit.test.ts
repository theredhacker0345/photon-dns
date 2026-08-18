import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");
const exists = (relativePath: string) => existsSync(resolve(root, relativePath));

describe("Pocket Agent Host ten-workstream release contracts", () => {
  it("covers the complete control-plane route surface", () => {
    for (const route of [
      "app/(tabs)/index.tsx",
      "app/(tabs)/agent.tsx",
      "app/(tabs)/automations.tsx",
      "app/(tabs)/settings.tsx",
      "app/setup.tsx",
      "app/gateway-test.tsx",
    ]) {
      expect(exists(route), `${route} should exist`).toBe(true);
    }
  });

  it("keeps dashboard telemetry and readiness connected to the host store", () => {
    const source = read("app/(tabs)/index.tsx");
    expect(source).toContain("useSupervisorTelemetry");
    expect(source).toContain("useHostReadiness");
    expect(source).toContain("prepareRuntime");
    expect(source).toContain("stopHost");
    expect(source).toContain("getSupervisorTelemetryPresentation");
    expect(source).toContain("telemetryNotice");
  });

  it("keeps agent and automation actions wired to durable runtime operations", () => {
    const agent = read("app/(tabs)/agent.tsx");
    const automations = read("app/(tabs)/automations.tsx");
    expect(agent).toContain("enqueueNativeTask");
    expect(agent).toContain("listNativeTasks");
    expect(agent).toContain("getNativeContextStatus");
    expect(agent).toContain("compressNativeContext");
    expect(agent).toContain("Compress context");
    expect(agent).toContain('accessibilityLabel="Submit owner task"');
    expect(automations).toContain("upsertNativeSchedule");
    expect(automations).toContain("setNativeScheduleEnabled");
    expect(automations).toContain("listNativeScheduleRuns");
    expect(automations).toContain("Android APK required");
    expect(automations).toContain("<Modal");
  });

  it("keeps setup and settings guarded by the shared policy/store boundary", () => {
    const setup = read("app/setup.tsx");
    const settings = read("app/(tabs)/settings.tsx");
    const store = read("lib/pocket-hermes-store.tsx");
    expect(setup).toContain("Name and protect this host");
    expect(setup).toContain("Lock remote access to you");
    expect(settings).toContain("saveConfiguration");
    expect(store).toContain("expo-secure-store");
    expect(store).toContain("prepareRuntime");
    expect(store).toContain("allowedChatId");
  });

  it("keeps the Android supervisor sticky and foreground-bound", () => {
    const service = read("modules/pocket-hermes-supervisor/android/src/main/java/expo/modules/pockethermessupervisor/PocketHermesSupervisorService.kt");
    const module = read("modules/pocket-hermes-supervisor/android/src/main/java/expo/modules/pockethermessupervisor/PocketHermesSupervisorModule.kt");
    expect(service).toContain("START_STICKY");
    expect(service).toContain("startForeground");
    expect(service).toContain("Python.start");
    expect(module).toContain("startSupervisor");
    expect(module).toContain("getTelemetry");
  });

  it("keeps the worker Telegram-only and free of shell/browser escape hatches", () => {
    const worker = read("modules/pocket-hermes-supervisor/android/src/main/python/pocket_hermes_worker.py");
    expect(worker).toContain("TELEGRAM_ALLOWED_USERS");
    expect(worker).toContain("start_gateway");
    expect(worker).not.toMatch(/subprocess|os\.system|os\.popen|webbrowser|playwright|selenium/);
  });

  it("keeps the mobile runtime local rather than depending on the template backend", () => {
    const appSource = ["app", "components", "hooks", "lib"].flatMap((directory) => {
      const files = [
        "app/(tabs)/index.tsx",
        "app/(tabs)/agent.tsx",
        "app/(tabs)/automations.tsx",
        "app/(tabs)/settings.tsx",
        "components/screen-container.tsx",
        "hooks/use-host-readiness.ts",
        "lib/pocket-hermes-store.tsx",
      ];
      return files.filter((file) => file.startsWith(directory + "/")).map(read);
    }).join("\n");
    expect(appSource).not.toMatch(/@\/lib\/trpc|trpc\.use|axios\.(get|post|put|delete)/);
  });

  it("keeps the FOSS release gate and metadata present", () => {
    const sbom = JSON.parse(read("sbom.json")) as { bomFormat: string; components: Array<{ name: string }> };
    expect(sbom.bomFormat).toBe("CycloneDX");
    expect(sbom.components.length).toBeGreaterThan(0);
    expect(sbom.components.some((component) => component.name === "hermes-agent")).toBe(true);
    expect(sbom.components.some((component) => component.name === "jiter")).toBe(true);
    expect(exists("docs/foss-and-apk-readiness-audit.md")).toBe(true);
    expect(exists("metadata/com.app.pockethermes.yml")).toBe(true);
    expect(exists("fastlane/metadata/android/en-US/full_description.txt")).toBe(true);
  });

  it("keeps release size and ABI constraints source-controlled", () => {
    const config = read("app.config.ts");
    const abiPlugin = read("plugins/with-arm64-only.js");
    const shrinkPlugin = read("plugins/with-release-shrinking.js");
    expect(config).toContain("with-arm64-only");
    expect(config).toContain("with-release-shrinking");
    expect(abiPlugin).toContain("arm64-v8a");
    expect(abiPlugin).toContain("POCKET_HERMES_ANDROID_ABIS");
    expect(shrinkPlugin).toContain("android.enableMinifyInReleaseBuilds");
    expect(shrinkPlugin).toContain("android.enableShrinkResourcesInReleaseBuilds");
  });

  it("keeps the measured optimized APK available when native build artifacts are present", () => {
    const apkPath = "android/app/build/outputs/apk/release/app-release.apk";
    if (exists(apkPath)) {
      expect(readFileSync(resolve(root, apkPath)).byteLength).toBeGreaterThan(70_000_000);
    }
  });
});
