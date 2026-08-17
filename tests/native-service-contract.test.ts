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

  it("persists and enforces the same charging and storage policy for direct starts, recovery, and boot restoration", () => {
    const service = read("java/expo/modules/pockethermessupervisor/PocketHermesSupervisorService.kt");
    expect(service).toContain("val chargingAware: Boolean = true");
    expect(service).toContain("val minimumFreeStorageBytes");
    expect(service).toContain("hostPolicyBlock(config)");
    expect(service).toContain("Intent.ACTION_BATTERY_CHANGED");
    expect(service).toContain("filesDir.usableSpace < config.minimumFreeStorageBytes");
    expect(service).toContain("PREF_CHARGING_AWARE");
    expect(service).toContain("PREF_MINIMUM_FREE_STORAGE_BYTES");
    expect(service).toContain("EXTRA_CHARGING_AWARE");
    expect(service).toContain("EXTRA_MINIMUM_FREE_STORAGE_BYTES");
  });

  it("threads bounded CPU, RAM, and private-workspace guardrails through the Android supervisor", () => {
    const service = read("java/expo/modules/pockethermessupervisor/PocketHermesSupervisorService.kt");
    const module = read("java/expo/modules/pockethermessupervisor/PocketHermesSupervisorModule.kt");
    const worker = read("python/pocket_hermes_worker.py");
    expect(service).toContain("maximumCpuPercent");
    expect(service).toContain("maximumProcessRamBytes");
    expect(service).toContain("maximumWorkspaceBytes");
    expect(service).toContain("PREF_MAXIMUM_CPU_PERCENT");
    expect(service).toContain("PREF_MAXIMUM_PROCESS_RAM_BYTES");
    expect(service).toContain("PREF_MAXIMUM_WORKSPACE_BYTES");
    expect(service).toContain("resourceLimitBlock(config)");
    expect(service).toContain("CPU_LIMIT_CONSECUTIVE_SAMPLES");
    expect(module).toContain("maximumCpuPercent");
    expect(module).toContain("maximumProcessRamBytes");
    expect(module).toContain("maximumWorkspaceBytes");
    expect(worker).toContain("def _workspace_limit_reason(");
    expect(worker).toContain("def _normalize_maximum_workspace_bytes(");
  });

  it("keeps worker health and diagnostics secret-free across the Python, Kotlin, and TypeScript boundary", () => {
    const worker = read("python/pocket_hermes_worker.py");
    const state = read("java/expo/modules/pockethermessupervisor/SupervisorRuntimeState.kt");
    const module = read("java/expo/modules/pockethermessupervisor/PocketHermesSupervisorModule.kt");
    const service = read("java/expo/modules/pockethermessupervisor/PocketHermesSupervisorService.kt");
    expect(worker).toContain("def status_json()");
    expect(worker).toContain("def context_status_json()");
    expect(worker).toContain("def compress_owner_context()");
    expect(worker).toContain("_context_compress_lock");
    expect(worker).toContain("_handle_compress_command(event)");
    expect(worker).toContain("This intentionally never serializes a transcript");
    expect(worker).toContain("def preflight_model(");
    expect(worker).toContain("def invoke_remote_mcp_tool(");
    expect(worker).toContain("def update_remote_mcp_config(");
    expect(worker).toContain("_NoMcpRedirects");
    expect(worker).toContain('os.environ["HERMES_DISABLE_MCP"] = "1"');
    expect(worker).toContain("The owner approval for this MCP tool has expired or is missing.");
    expect(worker).toContain("def enqueue_task(");
    expect(worker).toContain("async def _drain_task_queue()");
    expect(worker).toContain("def validate_cron_expression(");
    expect(worker).toContain("async def _scheduler_loop()");
    expect(worker).toContain("_MAX_SCHEDULE_RETRIES = 2");
    expect(worker).toContain("def upsert_schedule(");
    expect(worker).toContain("def list_schedule_runs_json()");
    expect(worker).toContain("urlopen(request, timeout=12)");
    expect(worker).toContain("lastHeartbeatAt");
    expect(worker).toContain('os.environ["TELEGRAM_ALLOWED_USERS"] = owner_chat_id');
    expect(worker).toContain('os.environ["GATEWAY_ALLOW_ALL_USERS"] = "false"');
    expect(worker).toContain('os.environ["TELEGRAM_GROUP_ALLOWED_USERS"] = ""');
    expect(worker).toContain("Pocket Agent Host requires an endpoint, model name, and model credential.");
    expect(worker).not.toContain("traceback.print_exc()");
    expect(state).toContain("MAX_DIAGNOSTICS = 40");
    expect(state).toContain("message.take(160)");
    expect(module).toContain("AsyncFunction(\"getHealth\")");
    expect(module).toContain("AsyncFunction(\"getDiagnostics\")");
    expect(module).toContain("AsyncFunction(\"getContextStatus\")");
    expect(module).toContain("AsyncFunction(\"compressContext\")");
    expect(module).toContain("contextMap");
    expect(module).toContain("AsyncFunction(\"enqueueTask\")");
    expect(module).toContain("AsyncFunction(\"listTasks\")");
    expect(module).toContain("AsyncFunction(\"cancelTask\")");
    expect(module).toContain("AsyncFunction(\"upsertSchedule\")");
    expect(module).toContain("AsyncFunction(\"listSchedules\")");
    expect(module).toContain("AsyncFunction(\"setScheduleEnabled\")");
    expect(module).toContain("AsyncFunction(\"deleteSchedule\")");
    expect(module).toContain("AsyncFunction(\"listScheduleRuns\")");
    expect(module).toContain("AsyncFunction(\"preflightModel\")");
    expect(module).toContain("AsyncFunction(\"updateMcpRuntimeConfig\")");
    expect(module).toContain("AsyncFunction(\"clearConfiguration\")");
    expect(module).toContain("mcpConfigJson");
    expect(service).toContain("PREF_MCP_CONFIG_JSON");
    expect(service).toContain("EXTRA_MCP_CONFIG_JSON");
    expect(service).toContain("ACTION_UPDATE_MCP_CONFIG");
    expect(service).toContain("fun updateMcpRuntimeConfig");
    expect(service).toContain("update_remote_mcp_config");
    expect(service).toContain("fun clearPersistedConfiguration");
  });
});
