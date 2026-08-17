package expo.modules.pockethermessupervisor

import android.app.ActivityManager
import android.content.Context
import android.os.Process
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class PocketHermesSupervisorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PocketHermesSupervisor")

    AsyncFunction("getTelemetry") {
      val context = requireNotNull(appContext.reactContext) {
        "Pocket Agent Host supervisor requires an Android application context."
      }
      val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      val memoryInfo = ActivityManager.MemoryInfo().also(activityManager::getMemoryInfo)
      val processMemory = activityManager
        .getProcessMemoryInfo(intArrayOf(Process.myPid()))
        .firstOrNull()
      val usedBytes = (processMemory?.totalPss ?: 0).toLong() * 1024L

      mapOf(
        "agentStatus" to if (SupervisorRuntimeState.isRunning) SupervisorRuntimeState.workerStatus else "stopped",
        "cpuPercent" to SupervisorRuntimeState.sampleCpuPercent(),
        "ramUsedBytes" to usedBytes,
        "ramTotalBytes" to memoryInfo.totalMem,
        "sampledAt" to System.currentTimeMillis().toString(),
      )
    }

    AsyncFunction("getHealth") {
      SupervisorRuntimeState.healthSnapshot()
    }

    AsyncFunction("getDiagnostics") {
      SupervisorRuntimeState.diagnosticSnapshot()
    }

    AsyncFunction("enqueueTask") { task: Map<String, String> ->
      val context = requireNotNull(appContext.reactContext) {
        "Pocket Agent Host supervisor requires an Android application context."
      }
      if (!Python.isStarted()) Python.start(AndroidPlatform(context.applicationContext))
      val raw = Python.getInstance().getModule("pocket_hermes_worker").callAttr(
        "enqueue_task",
        task["id"]?.trim().orEmpty(),
        task["body"]?.trim().orEmpty(),
      ).toString()
      taskMap(JSONObject(raw))
    }

    AsyncFunction("listTasks") {
      val context = requireNotNull(appContext.reactContext) {
        "Pocket Agent Host supervisor requires an Android application context."
      }
      if (!Python.isStarted()) Python.start(AndroidPlatform(context.applicationContext))
      val raw = Python.getInstance().getModule("pocket_hermes_worker").callAttr("list_tasks_json").toString()
      val tasks = org.json.JSONArray(raw)
      (0 until tasks.length()).map { index -> taskMap(tasks.getJSONObject(index)) }
    }

    AsyncFunction("cancelTask") { taskId: String ->
      val context = requireNotNull(appContext.reactContext) {
        "Pocket Agent Host supervisor requires an Android application context."
      }
      if (!Python.isStarted()) Python.start(AndroidPlatform(context.applicationContext))
      val raw = Python.getInstance().getModule("pocket_hermes_worker").callAttr("cancel_task", taskId.trim()).toString()
      taskMap(JSONObject(raw))
    }

    AsyncFunction("upsertSchedule") { schedule: Map<String, String> ->
      val context = requireNotNull(appContext.reactContext) {
        "Pocket Agent Host supervisor requires an Android application context."
      }
      val raw = workerModule(context).callAttr(
        "upsert_schedule",
        schedule["id"]?.trim().orEmpty(),
        schedule["title"]?.trim().orEmpty(),
        schedule["expression"]?.trim().orEmpty(),
        schedule["body"]?.trim().orEmpty(),
        schedule["enabled"]?.toBooleanStrictOrNull() ?: false,
      ).toString()
      scheduleMap(JSONObject(raw))
    }

    AsyncFunction("listSchedules") {
      val context = requireNotNull(appContext.reactContext) {
        "Pocket Agent Host supervisor requires an Android application context."
      }
      val schedules = org.json.JSONArray(workerModule(context).callAttr("list_schedules_json").toString())
      (0 until schedules.length()).map { index -> scheduleMap(schedules.getJSONObject(index)) }
    }

    AsyncFunction("setScheduleEnabled") { scheduleId: String, enabled: Boolean ->
      val context = requireNotNull(appContext.reactContext) {
        "Pocket Agent Host supervisor requires an Android application context."
      }
      val raw = workerModule(context).callAttr("set_schedule_enabled", scheduleId.trim(), enabled).toString()
      scheduleMap(JSONObject(raw))
    }

    AsyncFunction("deleteSchedule") { scheduleId: String ->
      val context = requireNotNull(appContext.reactContext) {
        "Pocket Agent Host supervisor requires an Android application context."
      }
      workerModule(context).callAttr("delete_schedule", scheduleId.trim())
      mapOf("status" to "deleted")
    }

    AsyncFunction("listScheduleRuns") {
      val context = requireNotNull(appContext.reactContext) {
        "Pocket Agent Host supervisor requires an Android application context."
      }
      val runs = org.json.JSONArray(workerModule(context).callAttr("list_schedule_runs_json").toString())
      (0 until runs.length()).map { index -> scheduleRunMap(runs.getJSONObject(index)) }
    }

    AsyncFunction("preflightModel") { config: Map<String, String?> ->
      val context = requireNotNull(appContext.reactContext) {
        "Pocket Agent Host supervisor requires an Android application context."
      }
      if (!Python.isStarted()) Python.start(AndroidPlatform(context.applicationContext))
      val raw = Python.getInstance().getModule("pocket_hermes_worker").callAttr(
        "preflight_model",
        config["modelEndpoint"]?.trim().orEmpty(),
        config["modelApiKey"]?.trim().orEmpty(),
        config["modelName"]?.trim().orEmpty(),
      ).toString()
      val result = JSONObject(raw)
      mapOf("ok" to result.optBoolean("ok", false), "reason" to result.optString("reason", "model preflight unavailable"))
    }

    AsyncFunction("startSupervisor") { config: Map<String, String?> ->
      val context = requireNotNull(appContext.reactContext) {
        "Pocket Agent Host supervisor requires an Android application context."
      }
      val telegramToken = config["telegramToken"]?.trim().orEmpty()
      val ownerChatId = config["ownerChatId"]?.trim().orEmpty()
      if (telegramToken.isBlank() || ownerChatId.isBlank()) {
        throw IllegalArgumentException("Pocket Agent Host requires a Telegram token and owner chat ID to start.")
      }
      PocketHermesSupervisorService.start(
        context,
        PocketHermesWorkerConfig(
          telegramToken = telegramToken,
          ownerChatId = ownerChatId,
          modelEndpoint = config["modelEndpoint"]?.trim()?.ifBlank { null },
          modelApiKey = config["modelApiKey"]?.trim()?.ifBlank { null },
          modelName = config["modelName"]?.trim()?.ifBlank { null },
          mcpConfigJson = config["mcpConfigJson"]?.trim()?.ifBlank { null },
          restartAfterBoot = config["restartAfterBoot"]?.toBooleanStrictOrNull() ?: false,
          chargingAware = config["chargingAware"]?.toBooleanStrictOrNull() ?: true,
          lowBatteryPercent = config["lowBatteryPercent"]?.toIntOrNull() ?: 20,
          minimumFreeStorageBytes = config["minimumFreeStorageBytes"]?.toLongOrNull() ?: 2L * 1024L * 1024L * 1024L,
        ),
      )
      mapOf("status" to "starting")
    }

    AsyncFunction("updateMcpRuntimeConfig") { mcpConfigJson: String? ->
      val context = requireNotNull(appContext.reactContext) {
        "Pocket Agent Host supervisor requires an Android application context."
      }
      PocketHermesSupervisorService.updateMcpRuntimeConfig(
        context,
        mcpConfigJson?.trim()?.ifBlank { null },
      )
      mapOf("status" to "updated")
    }

    AsyncFunction("stopSupervisor") {
      val context = requireNotNull(appContext.reactContext) {
        "Pocket Agent Host supervisor requires an Android application context."
      }
      PocketHermesSupervisorService.stop(context)
      mapOf("status" to "stopped")
    }

    AsyncFunction("clearConfiguration") {
      val context = requireNotNull(appContext.reactContext) {
        "Pocket Agent Host supervisor requires an Android application context."
      }
      PocketHermesSupervisorService.clearPersistedConfiguration(context)
      mapOf("status" to "cleared")
    }
  }

  private fun taskMap(task: JSONObject): Map<String, String?> = mapOf(
    "id" to task.optString("id"),
    "body" to task.optString("body"),
    "status" to task.optString("status", "failed"),
    "createdAt" to task.opt("createdAt")?.toString(),
    "updatedAt" to task.opt("updatedAt")?.toString(),
    "result" to task.opt("result")?.takeUnless { it == JSONObject.NULL }?.toString(),
    "reason" to task.opt("reason")?.takeUnless { it == JSONObject.NULL }?.toString(),
  )

  private fun workerModule(context: Context) = run {
    if (!Python.isStarted()) Python.start(AndroidPlatform(context.applicationContext))
    Python.getInstance().getModule("pocket_hermes_worker").also { worker ->
    worker.callAttr("set_storage_root", java.io.File(context.filesDir, "pocket-hermes/runtime").apply { mkdirs() }.absolutePath)
    }
  }

  private fun scheduleMap(schedule: JSONObject): Map<String, Any?> = mapOf(
    "id" to schedule.optString("id"),
    "title" to schedule.optString("title"),
    "expression" to schedule.optString("expression"),
    "body" to schedule.optString("body"),
    "enabled" to schedule.optBoolean("enabled", false),
    "lastRunAt" to schedule.opt("lastRunAt")?.takeUnless { it == JSONObject.NULL }?.toString(),
    "lastRunStatus" to schedule.opt("lastRunStatus")?.takeUnless { it == JSONObject.NULL }?.toString(),
    "nextRetryAt" to schedule.opt("nextRetryAt")?.takeUnless { it == JSONObject.NULL }?.toString(),
  )

  private fun scheduleRunMap(run: JSONObject): Map<String, Any?> = mapOf(
    "id" to run.optString("id"),
    "scheduleId" to run.optString("scheduleId"),
    "scheduleTitle" to run.optString("scheduleTitle"),
    "status" to run.optString("status", "failed"),
    "attempt" to run.optInt("attempt", 0),
    "createdAt" to run.opt("createdAt")?.toString(),
    "updatedAt" to run.opt("updatedAt")?.toString(),
    "reason" to run.opt("reason")?.takeUnless { it == JSONObject.NULL }?.toString(),
  )
}
