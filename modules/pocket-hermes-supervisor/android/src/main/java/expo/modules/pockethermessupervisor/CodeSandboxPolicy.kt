package expo.modules.pockethermessupervisor

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONObject
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicReference
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Main-process policy gate. The isolated executor cannot read this encrypted approval ledger. */
internal object CodeSandboxPolicy {
  const val MAX_SOURCE_BYTES = 24 * 1024
  const val DEFAULT_TIMEOUT_MS = 750
  const val DEFAULT_MEMORY_BYTES = 16 * 1024 * 1024
  const val DEFAULT_MAX_OUTPUT_BYTES = 8 * 1024
  private const val MAX_TIMEOUT_MS = 5_000
  private const val MAX_MEMORY_BYTES = 64 * 1024 * 1024
  private const val MAX_OUTPUT_BYTES = 32 * 1024
  private const val MIN_TIMEOUT_MS = 50
  private const val MIN_MEMORY_BYTES = 4 * 1024 * 1024
  private const val MIN_OUTPUT_BYTES = 256
  private const val APPROVAL_TTL_MS = 10 * 60 * 1000L
  private const val BINDER_CONNECT_TIMEOUT_MS = 1_000L
  private const val BINDER_RESPONSE_GRACE_MS = 250L
  private const val MAX_AUDIT_ENTRIES = 50
  private const val PREFS = "pocket-hermes-code-sandbox"
  private const val ENABLED = "enabled"
  private const val APPROVAL_PREFIX = "approval-"
  private const val AUDIT_PREFIX = "audit-"

  fun status(context: Context): Map<String, Any> {
    val preferences = preferences(context)
    pruneLedger(preferences)
    val now = System.currentTimeMillis()
    val activeApprovals = preferences.all.filter { (key, value) ->
      key.startsWith(APPROVAL_PREFIX) && (value as? Long ?: 0L) > now
    }.count()
    return mapOf(
      "enabled" to preferences.getBoolean(ENABLED, false),
      "activeApprovals" to activeApprovals,
      "defaultTimeoutMs" to DEFAULT_TIMEOUT_MS,
      "defaultMemoryBytes" to DEFAULT_MEMORY_BYTES,
      "defaultMaxOutputBytes" to DEFAULT_MAX_OUTPUT_BYTES,
      "fixedExecutionEnvelope" to true,
    )
  }

  fun setEnabled(context: Context, enabled: Boolean): Map<String, Any> {
    preferences(context).edit().putBoolean(ENABLED, enabled).commit()
    return status(context)
  }

  /**
   * Returns a bounded owner-visible history of execution metadata. This deliberately
   * omits submitted source, output bodies, exception text, and all approval records.
   */
  fun listAuditLog(context: Context): List<Map<String, Any>> {
    val preferences = preferences(context)
    pruneLedger(preferences)
    return preferences.all
      .asSequence()
      .filter { (key, _) -> key.startsWith(AUDIT_PREFIX) }
      .mapNotNull { (_, value) -> auditMetadata(value as? String) }
      .sortedByDescending { entry -> entry["occurredAt"].toString().toLongOrNull() ?: 0L }
      .take(MAX_AUDIT_ENTRIES)
      .toList()
  }

  fun propose(source: String): Map<String, Any> {
    validateSource(source)
    return mapOf("hash" to hash(source), "sourceBytes" to source.toByteArray(Charsets.UTF_8).size, "approvalRequired" to true)
  }

  fun approve(context: Context, source: String): Map<String, Any> {
    validateSource(source)
    pruneLedger(preferences(context))
    val sourceHash = hash(source)
    val expiresAt = System.currentTimeMillis() + APPROVAL_TTL_MS
    preferences(context).edit().putLong("$APPROVAL_PREFIX$sourceHash", expiresAt).commit()
    return mapOf("hash" to sourceHash, "expiresAt" to expiresAt.toString(), "approved" to true)
  }

  fun revoke(context: Context, sourceHash: String): Map<String, Any> {
    if (!sourceHash.matches(Regex("[a-f0-9]{64}"))) throw IllegalArgumentException("invalid source hash")
    val preferences = preferences(context)
    pruneLedger(preferences)
    preferences.edit().remove("$APPROVAL_PREFIX$sourceHash").commit()
    return mapOf("hash" to sourceHash, "revoked" to true)
  }

  fun execute(context: Context, source: String, timeoutMs: Int?, memoryBytes: Int?, maxOutputBytes: Int?): Map<String, Any> {
    validateSource(source)
    val preferences = preferences(context)
    pruneLedger(preferences)
    if (!preferences.getBoolean(ENABLED, false)) return audited(context, source, "rejected", "owner has not enabled code execution", false, false)
    if (!usesFixedEnvelope(timeoutMs, memoryBytes, maxOutputBytes)) {
      return audited(context, source, "rejected", "approved code jobs use the fixed 750 ms, 16 MiB, and 8 KiB execution envelope", false, false)
    }
    val sourceHash = hash(source)
    val expiry = preferences.getLong("$APPROVAL_PREFIX$sourceHash", 0L)
    if (expiry <= System.currentTimeMillis()) {
      preferences.edit().remove("$APPROVAL_PREFIX$sourceHash").commit()
      return audited(context, source, "rejected", "source hash has no active owner approval", false, false)
    }

    val request = JSONObject()
      .put("source", source)
      .put("timeoutMs", DEFAULT_TIMEOUT_MS)
      .put("memoryBytes", DEFAULT_MEMORY_BYTES)
      .put("maxOutputBytes", DEFAULT_MAX_OUTPUT_BYTES)
    val raw = invokeIsolatedExecutor(context.applicationContext, request.toString())
    val result = runCatching { JSONObject(raw) }.getOrElse { JSONObject(resultJson("error", "isolated executor returned an invalid response", false, false)) }
    return audited(
      context,
      source,
      result.optString("status", "error"),
      result.optString("output", "execution result unavailable"),
      result.optBoolean("truncated", false),
      result.optBoolean("timedOut", false),
    )
  }

  fun resultJson(status: String, output: String, truncated: Boolean, timedOut: Boolean): String = JSONObject()
    .put("status", status)
    .put("output", output)
    .put("truncated", truncated)
    .put("timedOut", timedOut)
    .toString()

  private fun audited(context: Context, source: String, status: String, output: String, truncated: Boolean, timedOut: Boolean): Map<String, Any> {
    val sourceHash = hash(source)
    val occurredAt = System.currentTimeMillis()
    val redactedOutput = output.take(MAX_OUTPUT_BYTES)
    val preferences = preferences(context)
    preferences.edit().putString("$AUDIT_PREFIX$occurredAt-$sourceHash", JSONObject()
      .put("hash", sourceHash)
      .put("status", status)
      .put("occurredAt", occurredAt.toString())
      .put("outputBytes", redactedOutput.toByteArray(Charsets.UTF_8).size)
      .put("truncated", truncated)
      .put("timedOut", timedOut)
      .toString()).commit()
    pruneLedger(preferences)
    return mapOf("hash" to sourceHash, "status" to status, "output" to redactedOutput, "truncated" to truncated, "timedOut" to timedOut, "occurredAt" to occurredAt.toString())
  }

  private fun invokeIsolatedExecutor(context: Context, requestJson: String): String {
    val latch = CountDownLatch(1)
    var executor: ICodeSandboxExecutor? = null
    var connected = false
    val connection = object : ServiceConnection {
      override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
        executor = ICodeSandboxExecutor.Stub.asInterface(service)
        latch.countDown()
      }
      override fun onServiceDisconnected(name: ComponentName?) { executor = null }
    }
    return try {
      connected = context.bindService(Intent(context, QuickJsSandboxService::class.java), connection, Context.BIND_AUTO_CREATE)
      if (!connected || !latch.await(BINDER_CONNECT_TIMEOUT_MS, TimeUnit.MILLISECONDS)) return resultJson("error", "isolated executor did not become available", false, false)
      val result = AtomicReference<String?>(null)
      val responseLatch = CountDownLatch(1)
      Thread({
        try {
          result.set(executor?.execute(requestJson))
        } catch (_: Exception) {
          result.set(resultJson("error", "isolated execution failed without exposing host details", false, false))
        } finally {
          responseLatch.countDown()
        }
      }, "pocket-agent-code-sandbox").start()
      if (!responseLatch.await(DEFAULT_TIMEOUT_MS + BINDER_RESPONSE_GRACE_MS, TimeUnit.MILLISECONDS)) {
        return resultJson("timeout", "isolated executor exceeded the fixed execution envelope", false, true)
      }
      result.get() ?: resultJson("error", "isolated executor binder unavailable", false, false)
    } catch (_: Exception) {
      resultJson("error", "isolated execution failed without exposing host details", false, false)
    } finally {
      if (connected) runCatching { context.unbindService(connection) }
      runCatching { context.stopService(Intent(context, QuickJsSandboxService::class.java)) }
    }
  }

  private fun usesFixedEnvelope(timeoutMs: Int?, memoryBytes: Int?, maxOutputBytes: Int?): Boolean =
    (timeoutMs == null || timeoutMs == DEFAULT_TIMEOUT_MS) &&
      (memoryBytes == null || memoryBytes == DEFAULT_MEMORY_BYTES) &&
      (maxOutputBytes == null || maxOutputBytes == DEFAULT_MAX_OUTPUT_BYTES)

  /** Maps encrypted ledger JSON into the precise, owner-safe viewer schema. */
  private fun auditMetadata(rawEntry: String?): Map<String, Any>? {
    val entry = runCatching { JSONObject(rawEntry.orEmpty()) }.getOrNull() ?: return null
    val sourceHash = entry.optString("hash")
    if (!sourceHash.matches(Regex("[a-f0-9]{64}"))) return null
    val status = entry.optString("status").takeIf { it in setOf("ok", "error", "timeout", "rejected") } ?: "error"
    val occurredAt = entry.optString("occurredAt").toLongOrNull() ?: return null
    return mapOf(
      "hash" to sourceHash,
      "status" to status,
      "occurredAt" to occurredAt.toString(),
      "outputBytes" to entry.optLong("outputBytes", 0L).coerceIn(0L, MAX_OUTPUT_BYTES.toLong()),
      "truncated" to entry.optBoolean("truncated", false),
      "timedOut" to entry.optBoolean("timedOut", false),
    )
  }

  private fun pruneLedger(preferences: android.content.SharedPreferences) {
    val now = System.currentTimeMillis()
    val expiredApprovalKeys = preferences.all
      .filter { (key, value) -> key.startsWith(APPROVAL_PREFIX) && (value as? Long ?: 0L) <= now }
      .keys
    val auditKeysToRemove = preferences.all.keys
      .filter { it.startsWith(AUDIT_PREFIX) }
      .sorted()
      .dropLast(MAX_AUDIT_ENTRIES)
    if (expiredApprovalKeys.isEmpty() && auditKeysToRemove.isEmpty()) return
    preferences.edit().apply {
      expiredApprovalKeys.forEach(::remove)
      auditKeysToRemove.forEach(::remove)
    }.commit()
  }

  private fun validateSource(source: String) {
    if (source.isBlank()) throw IllegalArgumentException("source is required")
    if (source.toByteArray(Charsets.UTF_8).size > MAX_SOURCE_BYTES) throw IllegalArgumentException("source exceeds the 24 KiB policy limit")
  }

  private fun hash(source: String): String = MessageDigest.getInstance("SHA-256").digest(source.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }

  private fun preferences(context: Context) = EncryptedSharedPreferences.create(
    context,
    PREFS,
    MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
  )
}
