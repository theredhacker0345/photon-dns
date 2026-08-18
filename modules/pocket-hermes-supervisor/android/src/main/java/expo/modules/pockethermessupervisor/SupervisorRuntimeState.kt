package expo.modules.pockethermessupervisor

import android.os.Process
import android.os.SystemClock
import java.util.ArrayDeque

/**
 * Holds only host-lifecycle state and rolling CPU sample values. It deliberately
 * contains no secrets, Telegram credentials, or arbitrary process-launch APIs.
 */
object SupervisorRuntimeState {
  private const val WORKSPACE_SNAPSHOT_MAX_AGE_MS = 15_000L
  @Volatile
  var isRunning: Boolean = false

  @Volatile
  var workerStatus: String = "stopped"

  @Volatile
  var workerReason: String = "not started"

  @Volatile
  var restartCount: Int = 0

  @Volatile
  var lastHeartbeatAt: Long? = null

  private const val MAX_DIAGNOSTICS = 40
  private val diagnostics = ArrayDeque<Map<String, Any?>>()

  @Synchronized
  private fun appendDiagnostic(category: String, severity: String, code: String, message: String) {
    diagnostics.addFirst(
      mapOf(
        "occurredAt" to System.currentTimeMillis().toString(),
        "category" to category,
        "severity" to severity,
        "code" to code,
        "message" to message.take(160),
      ),
    )
    while (diagnostics.size > MAX_DIAGNOSTICS) diagnostics.removeLast()
  }

  @Synchronized
  fun diagnosticSnapshot(): List<Map<String, Any?>> = diagnostics.toList()

  @Synchronized
  fun healthSnapshot(): Map<String, Any?> = mapOf(
    "state" to workerStatus,
    "detail" to workerReason,
    "lastHeartbeatAt" to lastHeartbeatAt?.toString(),
    "restartCount" to restartCount,
  )

  @Synchronized
  fun updateWorkerHealth(status: String, reason: String, heartbeatAt: Long?) {
    workerStatus = when (status) {
      "running", "starting", "degraded", "stopped" -> status
      else -> "degraded"
    }
    workerReason = reason.take(160)
    if (heartbeatAt != null && heartbeatAt > 0L) lastHeartbeatAt = heartbeatAt
  }

  @Synchronized
  fun markStarting(reason: String) {
    isRunning = true
    workerStatus = "starting"
    workerReason = reason
    appendDiagnostic("lifecycle", "info", "worker_starting", reason)
  }

  @Synchronized
  fun markStopped(reason: String) {
    isRunning = false
    workerStatus = "stopped"
    workerReason = reason
    appendDiagnostic("lifecycle", "info", "worker_stopped", reason)
  }

  @Synchronized
  fun markDegraded(reason: String) {
    workerStatus = "degraded"
    workerReason = reason
    appendDiagnostic("lifecycle", "warning", "worker_degraded", reason)
  }

  @Synchronized
  fun recordRecoveryAttempt(attempt: Int) {
    restartCount = attempt
    appendDiagnostic("lifecycle", "warning", "worker_recovery", "bounded worker recovery attempt $attempt")
  }

  @Synchronized
  fun clearRecoveryAttempts() {
    restartCount = 0
  }

  private var lastCpuTimeMillis: Long = 0L
  private var lastWallTimeMillis: Long = 0L
  @Volatile private var latestCpuPercent: Double = 0.0
  @Volatile private var latestWorkspaceBytes: Long? = null
  @Volatile private var latestWorkspaceSampleElapsedMs: Long = 0L

  @Synchronized
  fun sampleCpuPercent(): Double {
    val currentCpu = Process.getElapsedCpuTime()
    val currentWall = SystemClock.elapsedRealtime()
    val previousCpu = lastCpuTimeMillis
    val previousWall = lastWallTimeMillis
    lastCpuTimeMillis = currentCpu
    lastWallTimeMillis = currentWall

    if (previousWall == 0L || currentWall <= previousWall) return 0.0

    val elapsedCpu = (currentCpu - previousCpu).coerceAtLeast(0L)
    val elapsedWall = (currentWall - previousWall).coerceAtLeast(1L)
    val cores = Runtime.getRuntime().availableProcessors().coerceAtLeast(1)
    return ((elapsedCpu.toDouble() / elapsedWall.toDouble()) * 100.0 / cores.toDouble())
      .coerceIn(0.0, 100.0)
      .also { latestCpuPercent = it }
  }

  fun latestCpuPercent(): Double = latestCpuPercent

  fun recordWorkspaceBytes(bytes: Long) {
    latestWorkspaceBytes = bytes.coerceAtLeast(0L)
    latestWorkspaceSampleElapsedMs = SystemClock.elapsedRealtime()
  }

  fun freshWorkspaceBytes(): Long? {
    val bytes = latestWorkspaceBytes ?: return null
    return bytes.takeIf { SystemClock.elapsedRealtime() - latestWorkspaceSampleElapsedMs <= WORKSPACE_SNAPSHOT_MAX_AGE_MS }
  }
}
