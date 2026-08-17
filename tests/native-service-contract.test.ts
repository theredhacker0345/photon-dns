import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const moduleRoot = join(process.cwd(), "modules/pocket-hermes-supervisor/android/src/main");
const read = (path: string) => readFileSync(join(moduleRoot, path), "utf8");

describe("native Android host declaration contract", () => {
  it("declares the non-exported foreground service and only protected boot recovery inputs", () => {
    const manifest = read("AndroidManifest.xml");
    expect(manifest).toContain("FOREGROUND_SERVICE_DATA_SYNC");
    expect(manifest).toContain("RECEIVE_BOOT_COMPLETED");
    expect(manifest).toContain("android:name=\".PocketHermesSupervisorService\"");
    expect(manifest).toContain("android:exported=\"false\"");
    expect(manifest).toContain("android.intent.action.BOOT_COMPLETED");
  });

  it("only restarts after boot when the owner explicitly opted in and protected configuration exists", () => {
    const receiver = read("java/expo/modules/pockethermessupervisor/PocketHermesBootReceiver.kt");
    const service = read("java/expo/modules/pockethermessupervisor/PocketHermesSupervisorService.kt");
    expect(receiver).toContain("shouldRestartAfterBoot");
    expect(receiver).toContain("startFromPersistedConfiguration");
    expect(service).toContain("PREF_RESTART_AFTER_BOOT");
    expect(service).toContain("preferences.getBoolean(PREF_RESTART_AFTER_BOOT, false)");
    expect(service).toContain("PREF_MODEL_API_KEY");
  });

  it("prevents duplicate worker launch requests and keeps the ongoing notification safe to open", () => {
    const service = read("java/expo/modules/pockethermessupervisor/PocketHermesSupervisorService.kt");
    expect(service).toContain("private var workerLaunchRequested = false");
    expect(service).toContain("if (workerLaunchRequested) return");
    expect(service).toContain("MAX_RECOVERY_ATTEMPTS = 3");
    expect(service).toContain("RECOVERY_COOLDOWN_MS = 60_000L");
    expect(service).toContain("attemptBoundedRecovery()");
    expect(service).toContain("PendingIntent.FLAG_IMMUTABLE");
    expect(service).toContain("markStarting");
  });

  it("keeps worker health and diagnostics secret-free across the Python, Kotlin, and TypeScript boundary", () => {
    const worker = read("python/pocket_hermes_worker.py");
    const state = read("java/expo/modules/pockethermessupervisor/SupervisorRuntimeState.kt");
    const module = read("java/expo/modules/pockethermessupervisor/PocketHermesSupervisorModule.kt");
    const service = read("java/expo/modules/pockethermessupervisor/PocketHermesSupervisorService.kt");
    expect(worker).toContain("def status_json()");
    expect(worker).toContain("def preflight_model(");
    expect(worker).toContain("def enqueue_task(");
    expect(worker).toContain("async def _drain_task_queue()");
    expect(worker).toContain("urlopen(request, timeout=12)");
    expect(worker).toContain("lastHeartbeatAt");
    expect(worker).toContain('os.environ["TELEGRAM_ALLOWED_USERS"] = owner_chat_id');
    expect(worker).toContain('os.environ["GATEWAY_ALLOW_ALL_USERS"] = "false"');
    expect(worker).toContain('os.environ["TELEGRAM_GROUP_ALLOWED_USERS"] = ""');
    expect(worker).toContain("Pocket Hermes requires an endpoint, model name, and model credential.");
    expect(worker).not.toContain("traceback.print_exc()");
    expect(state).toContain("MAX_DIAGNOSTICS = 40");
    expect(state).toContain("message.take(160)");
    expect(module).toContain("AsyncFunction(\"getHealth\")");
    expect(module).toContain("AsyncFunction(\"getDiagnostics\")");
    expect(module).toContain("AsyncFunction(\"enqueueTask\")");
    expect(module).toContain("AsyncFunction(\"listTasks\")");
    expect(module).toContain("AsyncFunction(\"cancelTask\")");
    expect(module).toContain("AsyncFunction(\"preflightModel\")");
    expect(module).toContain("AsyncFunction(\"clearConfiguration\")");
    expect(service).toContain("fun clearPersistedConfiguration");
  });
});
