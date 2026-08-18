import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readProject = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("mobile performance guardrails", () => {
  it("pauses dashboard, settings, and Agent Console polling when their tab is not focused", () => {
    const telemetryHook = readProject("hooks/use-supervisor-telemetry.ts");
    const home = readProject("app/(tabs)/index.tsx");
    const settings = readProject("app/(tabs)/settings.tsx");
    const agent = readProject("app/(tabs)/agent.tsx");

    expect(telemetryHook).toContain("enabled = true");
    expect(telemetryHook).toContain("if (!enabled) return;");
    expect(home).toContain("const isFocused = useIsFocused();");
    expect(home).toContain("useSupervisorTelemetry(config.policy, isFocused)");
    expect(settings).toContain("useSupervisorTelemetry(defaultHostRuntimePolicy, isFocused)");
    expect(agent).toContain("if (!isFocused) return;");
    expect(agent).toContain("setInterval(() => void refresh(), 5_000)");
  });

  it("shares one fresh private-workspace measurement between the service guardrails and telemetry bridge", () => {
    const state = readProject("modules/pocket-hermes-supervisor/android/src/main/java/expo/modules/pockethermessupervisor/SupervisorRuntimeState.kt");
    const service = readProject("modules/pocket-hermes-supervisor/android/src/main/java/expo/modules/pockethermessupervisor/PocketHermesSupervisorService.kt");
    const module = readProject("modules/pocket-hermes-supervisor/android/src/main/java/expo/modules/pockethermessupervisor/PocketHermesSupervisorModule.kt");

    expect(state).toContain("WORKSPACE_SNAPSHOT_MAX_AGE_MS = 15_000L");
    expect(state).toContain("fun recordWorkspaceBytes(bytes: Long)");
    expect(state).toContain("fun freshWorkspaceBytes(): Long?");
    expect(service).toContain("val workspaceUsedBytes = privateWorkspaceBytes()");
    expect(service).toContain("hostPolicyBlock(config, workspaceUsedBytes, processRamBytes)");
    expect(service).toContain("resourceLimitBlock(config, workspaceUsedBytes, processRamBytes)");
    expect(service).toContain(".also(SupervisorRuntimeState::recordWorkspaceBytes)");
    expect(module).toContain("SupervisorRuntimeState.freshWorkspaceBytes()");
    expect(module).toContain("?: directoryBytes(workspaceDirectory).also(SupervisorRuntimeState::recordWorkspaceBytes)");
  });

  it("keeps every non-virtualized mobile history list within an explicit small retention bound", () => {
    const worker = readProject("modules/pocket-hermes-supervisor/android/src/main/python/pocket_hermes_worker.py");
    const policy = readProject("modules/pocket-hermes-supervisor/android/src/main/java/expo/modules/pockethermessupervisor/CodeSandboxPolicy.kt");
    const home = readProject("app/(tabs)/index.tsx");
    const automations = readProject("app/(tabs)/automations.tsx");

    expect(worker).toContain("_MAX_TASKS = 24");
    expect(worker).toContain("_MAX_SCHEDULES = 16");
    expect(worker).toContain("_MAX_SCHEDULE_RUNS = 72");
    expect(policy).toContain("private const val MAX_AUDIT_ENTRIES = 50");
    expect(home).toContain("events.slice(0, 4)");
    expect(automations).toContain("slice(0, 5)");
  });
});
