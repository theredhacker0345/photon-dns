package expo.modules.pockethermessupervisor

import android.os.Process
import android.os.SystemClock

/**
 * Holds only host-lifecycle state and rolling CPU sample values. It deliberately
 * contains no secrets, Telegram credentials, or arbitrary process-launch APIs.
 */
object SupervisorRuntimeState {
  @Volatile
  var isRunning: Boolean = false

  @Volatile
  var workerStatus: String = "stopped"

  @Volatile
  var workerReason: String = "not started"

  private var lastCpuTimeMillis: Long = 0L
  private var lastWallTimeMillis: Long = 0L

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
  }
}
