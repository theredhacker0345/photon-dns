package expo.modules.pockethermessupervisor

import android.app.Service
import android.content.Intent
import android.os.IBinder
import org.json.JSONObject

/**
 * One-request isolated-process executor. Android assigns it a distinct UID, and its manifest
 * declaration is non-exported. The service exposes only bounded JSON over Binder.
 */
class QuickJsSandboxService : Service() {
  private companion object {
    const val MAX_BINDER_REQUEST_BYTES = 32 * 1024
  }

  private val binder = object : ICodeSandboxExecutor.Stub() {
    override fun execute(requestJson: String): String = executeRequest(requestJson)
  }

  override fun onBind(intent: Intent?): IBinder = binder

  private fun executeRequest(requestJson: String): String {
    return try {
      if (requestJson.toByteArray(Charsets.UTF_8).size > MAX_BINDER_REQUEST_BYTES) {
        return CodeSandboxPolicy.resultJson("rejected", "sandbox request exceeds the 32 KiB policy limit", false, false)
      }
      val request = JSONObject(requestJson)
      val source = request.optString("source", "")
      val inputJson = request.opt("inputJson")?.takeUnless { it == JSONObject.NULL }?.toString()
      val timeoutMs = request.optInt("timeoutMs", CodeSandboxPolicy.DEFAULT_TIMEOUT_MS)
      val memoryBytes = request.optInt("memoryBytes", CodeSandboxPolicy.DEFAULT_MEMORY_BYTES)
      val maxOutputBytes = request.optInt("maxOutputBytes", CodeSandboxPolicy.DEFAULT_MAX_OUTPUT_BYTES)
      if (source.isBlank()) return CodeSandboxPolicy.resultJson("rejected", "source is required", false, false)
      if (source.toByteArray(Charsets.UTF_8).size > CodeSandboxPolicy.MAX_SOURCE_BYTES) return CodeSandboxPolicy.resultJson("rejected", "source exceeds the 24 KiB policy limit", false, false)
      if (inputJson != null && inputJson.toByteArray(Charsets.UTF_8).size > CodeSandboxPolicy.MAX_INPUT_BYTES) return CodeSandboxPolicy.resultJson("rejected", "skill input exceeds the 8 KiB policy limit", false, false)

      val result = QuickJsSandbox.execute(source, inputJson, memoryBytes, timeoutMs, maxOutputBytes)
      CodeSandboxPolicy.resultJson(result.status, result.output, result.truncated, result.timedOut)
    } catch (_: Exception) {
      CodeSandboxPolicy.resultJson("rejected", "malformed sandbox request", false, false)
    } finally {
      stopSelf()
    }
  }
}
