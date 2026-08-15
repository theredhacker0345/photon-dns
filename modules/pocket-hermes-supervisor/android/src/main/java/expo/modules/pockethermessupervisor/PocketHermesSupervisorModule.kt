package expo.modules.pockethermessupervisor

import android.app.ActivityManager
import android.content.Context
import android.os.Process
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PocketHermesSupervisorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PocketHermesSupervisor")

    AsyncFunction("getTelemetry") {
      val context = requireNotNull(appContext.reactContext) {
        "Pocket Hermes supervisor requires an Android application context."
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

    AsyncFunction("startSupervisor") { config: Map<String, String?> ->
      val context = requireNotNull(appContext.reactContext) {
        "Pocket Hermes supervisor requires an Android application context."
      }
      val telegramToken = config["telegramToken"]?.trim().orEmpty()
      val ownerChatId = config["ownerChatId"]?.trim().orEmpty()
      if (telegramToken.isBlank() || ownerChatId.isBlank()) {
        throw IllegalArgumentException("Pocket Hermes requires a Telegram token and owner chat ID to start.")
      }
      PocketHermesSupervisorService.start(
        context,
        PocketHermesWorkerConfig(
          telegramToken = telegramToken,
          ownerChatId = ownerChatId,
          modelEndpoint = config["modelEndpoint"]?.trim()?.ifBlank { null },
        ),
      )
      mapOf("status" to "starting")
    }

    AsyncFunction("stopSupervisor") {
      val context = requireNotNull(appContext.reactContext) {
        "Pocket Hermes supervisor requires an Android application context."
      }
      PocketHermesSupervisorService.stop(context)
      mapOf("status" to "stopped")
    }
  }
}
