package expo.modules.pockethermessupervisor

import android.util.Base64

/** Minimal JNI boundary for the vendored QuickJS core. It exposes no host callbacks. */
internal object QuickJsSandbox {
  init {
    System.loadLibrary("pocket_agent_sandbox")
  }

  data class Result(
    val status: String,
    val output: String,
    val truncated: Boolean,
    val timedOut: Boolean,
  )

  fun execute(source: String, memoryBytes: Int, timeoutMs: Int, maxOutputBytes: Int): Result {
    val fields = nativeExecute(source, memoryBytes, timeoutMs, maxOutputBytes).split('\t', limit = 4)
    val status = fields.getOrNull(0) ?: "error"
    val truncated = fields.getOrNull(1) == "1"
    val timedOut = fields.getOrNull(2) == "1"
    val output = fields.getOrNull(3)?.let { encoded ->
      runCatching { String(Base64.decode(encoded, Base64.DEFAULT), Charsets.UTF_8) }.getOrDefault("execution result was malformed")
    } ?: "execution result was unavailable"
    return Result(status, output, truncated, timedOut)
  }

  private external fun nativeExecute(source: String, memoryBytes: Int, timeoutMs: Int, maxOutputBytes: Int): String
}
